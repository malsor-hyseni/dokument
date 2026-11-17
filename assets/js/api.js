/**
 * DOKUMENT — Shtresa e të dhënave
 * -----------------------------------------------------------------------------
 * Çdo komunikim me Supabase kalon nga këtu: autentikimi, profili, kategoritë,
 * dosjet, etiketat, dokumentet, Storage-i dhe njoftimet.
 *
 * Çdo funksion hedh `Error` me mesazh të përkthyer në shqip në rast dështimi,
 * që faqet të mund t'i trajtojnë njësoj.
 */

import { supabase } from './supabase.js';
import { APP, ALLOWED_MIME } from './config.js';
import { translateError, safeFileName } from './utils.js';

/** Hedh gabim të përkthyer kur përgjigjja e Supabase ka error. */
function check({ data, error }, fallback = 'Veprimi dështoi.') {
  if (error) {
    console.error('[DOKUMENT API]', error);
    const err = new Error(translateError(error) || fallback);
    err.cause = error;
    err.code = error.code;
    throw err;
  }
  return data;
}

/* ===================================================== AUTENTIKIMI ======== */

export const auth = {
  /** Sesioni aktual ose null. */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session ?? null;
  },

  /** Përdoruesi aktual ose null. */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  },

  /** Regjistrim me email dhe fjalëkalim. */
  async signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: (fullName || '').trim() },
        emailRedirectTo: `${location.origin}/app.html`
      }
    });
    if (error) throw new Error(translateError(error));
    return {
      user: data.user,
      session: data.session,
      /** true kur Supabase kërkon konfirmim me email */
      needsConfirmation: !data.session && !!data.user
    };
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw new Error(translateError(error));
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(translateError(error));
  },

  /** Dërgon email për rivendosje të fjalëkalimit. */
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/reset-password.html`
    });
    if (error) throw new Error(translateError(error));
  },

  /** Ridërgon email-in e konfirmimit. */
  async resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${location.origin}/app.html` }
    });
    if (error) throw new Error(translateError(error));
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateError(error));
  },

  async updateEmail(newEmail) {
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim().toLowerCase() },
      { emailRedirectTo: `${location.origin}/app.html` }
    );
    if (error) throw new Error(translateError(error));
  },

  /** Verifikon fjalëkalimin aktual (për veprime të ndjeshme). */
  async verifyPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  },

  onChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
    return () => data.subscription.unsubscribe();
  }
};

/* ========================================================== PROFILI ======= */

export const profiles = {
  async get() {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(translateError(error));

    if (data) return { ...data, email: data.email || user.email };

    // Rrjedhë rezervë: profili krijohet nga trigger-i, por sigurohemi gjithsesi.
    const created = check(
      await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null
        })
        .select()
        .single(),
      'Krijimi i profilit dështoi.'
    );
    return created;
  },

  async update(patch) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    const allowed = ['full_name', 'phone', 'avatar_url', 'theme', 'expiry_warning_days', 'notifications_enabled'];
    const payload = {};
    for (const key of allowed) if (key in patch) payload[key] = patch[key];

    return check(
      await supabase.from('profiles').update(payload).eq('id', user.id).select().single(),
      'Ruajtja e profilit dështoi.'
    );
  },

  /** Ngarkon foton e profilit dhe kthen URL-në publike. */
  async uploadAvatar(file) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    if (!file.type.startsWith('image/')) throw new Error('Zgjedhni një imazh.');
    if (file.size > APP.maxAvatarSize) throw new Error('Imazhi duhet të jetë nën 2 MB.');

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(APP.avatarBucket)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (error) throw new Error(translateError(error));

    const { data } = supabase.storage.from(APP.avatarBucket).getPublicUrl(path);
    const url = data.publicUrl;
    await profiles.update({ avatar_url: url });
    return url;
  },

  async removeAvatar() {
    const user = await auth.getUser();
    if (!user) return;
    const { data: list } = await supabase.storage.from(APP.avatarBucket).list(user.id);
    if (list?.length) {
      await supabase.storage
        .from(APP.avatarBucket)
        .remove(list.map((item) => `${user.id}/${item.name}`));
    }
    await profiles.update({ avatar_url: null });
  }
};

/* ======================================================= KATEGORITË ======= */

export const categories = {
  async list() {
    return (
      check(
        await supabase.from('categories').select('*').order('name', { ascending: true }),
        'Marrja e kategorive dështoi.'
      ) || []
    );
  },

  /** Kategoritë bashkë me numrin e dokumenteve. */
  async listWithCounts() {
    const [list, counts] = await Promise.all([
      categories.list(),
      supabase.from('documents').select('category_id, file_size').eq('is_archived', false)
    ]);
    const rows = counts.data || [];
    return list.map((category) => {
      const own = rows.filter((row) => row.category_id === category.id);
      return {
        ...category,
        document_count: own.length,
        total_size: own.reduce((sum, row) => sum + (row.file_size || 0), 0)
      };
    });
  },

  async create({ name, color = 'slate', icon = 'folder', description = null }) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    return check(
      await supabase
        .from('categories')
        .insert({ user_id: user.id, name: name.trim(), color, icon, description })
        .select()
        .single(),
      'Krijimi i kategorisë dështoi.'
    );
  },

  async update(id, patch) {
    const payload = { ...patch };
    if (payload.name) payload.name = payload.name.trim();
    delete payload.user_id;
    delete payload.id;
    return check(
      await supabase.from('categories').update(payload).eq('id', id).select().single(),
      'Përditësimi i kategorisë dështoi.'
    );
  },

  /** Fshin kategorinë; dokumentet mbeten (category_id → null). */
  async remove(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw new Error(translateError(error));
  }
};

/* =========================================================== DOSJET ======= */

export const folders = {
  async list() {
    return (
      check(
        await supabase.from('folders').select('*').order('name', { ascending: true }),
        'Marrja e dosjeve dështoi.'
      ) || []
    );
  },

  /** Pema e dosjeve me thellësi dhe numër dokumentesh (RPC). */
  async tree() {
    return check(await supabase.rpc('get_folder_tree'), 'Marrja e dosjeve dështoi.') || [];
  },

  async create({ name, parent_id = null, color = 'slate' }) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    return check(
      await supabase
        .from('folders')
        .insert({ user_id: user.id, name: name.trim(), parent_id, color })
        .select()
        .single(),
      'Krijimi i dosjes dështoi.'
    );
  },

  async update(id, patch) {
    const payload = { ...patch };
    if (payload.name) payload.name = payload.name.trim();
    delete payload.user_id;
    delete payload.id;
    return check(
      await supabase.from('folders').update(payload).eq('id', id).select().single(),
      'Përditësimi i dosjes dështoi.'
    );
  },

  /** Fshin dosjen dhe nën-dosjet; dokumentet mbeten (folder_id → null). */
  async remove(id) {
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) throw new Error(translateError(error));
  }
};

/* ========================================================= ETIKETAT ======= */

export const tags = {
  async list() {
    return (
      check(
        await supabase.from('tags').select('*').order('name', { ascending: true }),
        'Marrja e etiketave dështoi.'
      ) || []
    );
  },

  async listWithCounts() {
    const [list, links] = await Promise.all([
      tags.list(),
      supabase.from('document_tags').select('tag_id')
    ]);
    const rows = links.data || [];
    return list.map((tag) => ({
      ...tag,
      document_count: rows.filter((row) => row.tag_id === tag.id).length
    }));
  },

  async create({ name, color = 'slate' }) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    return check(
      await supabase
        .from('tags')
        .insert({ user_id: user.id, name: name.trim(), color })
        .select()
        .single(),
      'Krijimi i etiketës dështoi.'
    );
  },

  async update(id, patch) {
    const payload = { ...patch };
    if (payload.name) payload.name = payload.name.trim();
    delete payload.user_id;
    delete payload.id;
    return check(
      await supabase.from('tags').update(payload).eq('id', id).select().single(),
      'Përditësimi i etiketës dështoi.'
    );
  },

  async remove(id) {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw new Error(translateError(error));
  },

  /** Krijon etiketat që mungojnë dhe kthen id-të e të gjithave. */
  async ensureMany(names = []) {
    const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (!clean.length) return [];
    const existing = await tags.list();
    const byName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag]));
    const result = [];
    for (const name of clean) {
      const found = byName.get(name.toLowerCase());
      if (found) result.push(found);
      else result.push(await tags.create({ name }));
    }
    return result;
  }
};

/* ====================================================== DOKUMENTET ======== */

export const documents = {
  /**
   * Kërkim me filtra dhe faqezim (RPC `search_documents`).
   * @returns {Promise<{rows:Array, total:number}>}
   */
  async search({
    query = '',
    categoryId = null,
    folderId = null,
    tagId = null,
    status = 'all',
    sort = 'created_desc',
    page = 1,
    pageSize = APP.pageSize
  } = {}) {
    const data =
      check(
        await supabase.rpc('search_documents', {
          q: query?.trim() || null,
          p_category: categoryId || null,
          p_folder: folderId || null,
          p_tag: tagId || null,
          p_status: status || 'all',
          p_sort: sort || 'created_desc',
          p_limit: pageSize,
          p_offset: (Math.max(1, page) - 1) * pageSize
        }),
        'Kërkimi dështoi.'
      ) || [];

    return {
      rows: data,
      total: data.length ? Number(data[0].total_count) : 0
    };
  },

  /** Një dokument i vetëm me kategorinë, dosjen dhe etiketat. */
  async get(id) {
    return check(
      await supabase
        .from('documents')
        .select(
          'id, title, description, file_name, file_size, mime_type, storage_path, issue_date, expiry_date, is_favorite, is_archived, created_at, updated_at, category_id, folder_id, categories(id,name,color,icon), folders(id,name,color), document_tags(tag:tags(id,name,color))'
        )
        .eq('id', id)
        .single(),
      'Dokumenti nuk u gjet.'
    );
  },

  /** Dokumentet më të fundit (dashboard). */
  async recent(limit = 6) {
    return (
      check(
        await supabase
          .from('documents')
          .select('id, title, file_name, file_size, mime_type, expiry_date, created_at, categories(name,color)')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(limit),
        'Marrja e dokumenteve dështoi.'
      ) || []
    );
  },

  /** Dokumentet që skadojnë brenda `days` ditëve, plus të skaduarat. */
  async expiring(days = 30, limit = 8) {
    const today = new Date();
    const until = new Date();
    until.setDate(today.getDate() + days);
    const iso = (d) => d.toISOString().slice(0, 10);

    return (
      check(
        await supabase
          .from('documents')
          .select('id, title, expiry_date, mime_type, file_name, categories(name,color)')
          .eq('is_archived', false)
          .not('expiry_date', 'is', null)
          .lte('expiry_date', iso(until))
          .order('expiry_date', { ascending: true })
          .limit(limit),
        'Marrja e dokumenteve dështoi.'
      ) || []
    );
  },

  /**
   * Ngarkon skedarin në Storage dhe krijon rreshtin në databazë.
   * Nëse krijimi i rreshtit dështon, skedari i ngarkuar fshihet (pa mbeturina).
   * @param {{file:File, title:string, description?:string, categoryId?:string|null,
   *          folderId?:string|null, issueDate?:string|null, expiryDate?:string|null,
   *          tagIds?:string[], onProgress?:Function}} input
   */
  async create({
    file,
    title,
    description = null,
    categoryId = null,
    folderId = null,
    issueDate = null,
    expiryDate = null,
    tagIds = [],
    onProgress
  }) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    if (!file) throw new Error('Zgjedhni një skedar.');
    if (file.size === 0) throw new Error('Skedari është bosh.');
    if (file.size > APP.maxFileSize) throw new Error('Skedari e kalon 50 MB.');

    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime)) {
      throw new Error('Ky lloj skedari nuk lejohet. Lejohen PDF, imazhe, Word, Excel, tekst dhe ZIP.');
    }

    // id-ja gjenerohet në klient për të ndërtuar rrugën e Storage-it
    const docId = crypto.randomUUID();
    const storagePath = `${user.id}/${docId}/${safeFileName(file.name)}`;

    onProgress?.({ phase: 'upload', percent: 10 });

    const { error: uploadError } = await supabase.storage
      .from(APP.bucket)
      .upload(storagePath, file, { contentType: mime, upsert: false, cacheControl: '3600' });
    if (uploadError) throw new Error(translateError(uploadError));

    onProgress?.({ phase: 'save', percent: 70 });

    try {
      const row = check(
        await supabase
          .from('documents')
          .insert({
            id: docId,
            user_id: user.id,
            title: title.trim(),
            description: description?.trim() || null,
            category_id: categoryId || null,
            folder_id: folderId || null,
            storage_path: storagePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: mime,
            issue_date: issueDate || null,
            expiry_date: expiryDate || null
          })
          .select()
          .single(),
        'Ruajtja e dokumentit dështoi.'
      );

      if (tagIds.length) await documents.setTags(docId, tagIds);
      onProgress?.({ phase: 'done', percent: 100 });
      return row;
    } catch (error) {
      // Rikthim: largo skedarin e ngarkuar që të mos mbetet jetim
      await supabase.storage.from(APP.bucket).remove([storagePath]).catch(() => {});
      throw error;
    }
  },

  async update(id, patch) {
    const payload = {};
    const map = {
      title: (v) => v.trim(),
      description: (v) => (v?.trim() ? v.trim() : null),
      category_id: (v) => v || null,
      folder_id: (v) => v || null,
      issue_date: (v) => v || null,
      expiry_date: (v) => v || null,
      is_favorite: (v) => !!v,
      is_archived: (v) => !!v
    };
    for (const [key, transform] of Object.entries(map)) {
      if (key in patch) payload[key] = transform(patch[key]);
    }
    return check(
      await supabase.from('documents').update(payload).eq('id', id).select().single(),
      'Përditësimi dështoi.'
    );
  },

  /** Zëvendëson skedarin fizik të një dokumenti. */
  async replaceFile(id, file) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
    if (file.size > APP.maxFileSize) throw new Error('Skedari e kalon 50 MB.');

    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime)) throw new Error('Ky lloj skedari nuk lejohet.');

    const current = check(
      await supabase.from('documents').select('storage_path').eq('id', id).single(),
      'Dokumenti nuk u gjet.'
    );

    const newPath = `${user.id}/${id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(APP.bucket)
      .upload(newPath, file, { contentType: mime, upsert: false });
    if (uploadError) throw new Error(translateError(uploadError));

    try {
      const row = check(
        await supabase
          .from('documents')
          .update({
            storage_path: newPath,
            file_name: file.name,
            file_size: file.size,
            mime_type: mime
          })
          .eq('id', id)
          .select()
          .single(),
        'Zëvendësimi dështoi.'
      );
      if (current.storage_path && current.storage_path !== newPath) {
        await supabase.storage.from(APP.bucket).remove([current.storage_path]).catch(() => {});
      }
      return row;
    } catch (error) {
      await supabase.storage.from(APP.bucket).remove([newPath]).catch(() => {});
      throw error;
    }
  },

  async toggleFavorite(id, value) {
    return documents.update(id, { is_favorite: value });
  },

  async setArchived(id, value) {
    return documents.update(id, { is_archived: value });
  },

  /** Fshin dokumentin: së pari skedarin në Storage, pastaj rreshtin. */
  async remove(id) {
    const row = check(
      await supabase.from('documents').select('storage_path').eq('id', id).single(),
      'Dokumenti nuk u gjet.'
    );
    if (row?.storage_path) {
      const { error } = await supabase.storage.from(APP.bucket).remove([row.storage_path]);
      // Nëse skedari mungon, vazhdojmë me fshirjen e rreshtit
      if (error && !/not found/i.test(error.message || '')) {
        throw new Error(translateError(error));
      }
    }
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw new Error(translateError(error));
  },

  /** Fshirje në grup. */
  async removeMany(ids = []) {
    if (!ids.length) return { deleted: 0 };
    const rows =
      check(
        await supabase.from('documents').select('id, storage_path').in('id', ids),
        'Dokumentet nuk u gjetën.'
      ) || [];
    const paths = rows.map((row) => row.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(APP.bucket).remove(paths).catch(() => {});
    const { error } = await supabase.from('documents').delete().in('id', ids);
    if (error) throw new Error(translateError(error));
    return { deleted: rows.length };
  },

  /** Zhvendos dokumentet në një dosje. */
  async moveMany(ids = [], folderId = null) {
    if (!ids.length) return;
    const { error } = await supabase
      .from('documents')
      .update({ folder_id: folderId || null })
      .in('id', ids);
    if (error) throw new Error(translateError(error));
  },

  /** Rivendos etiketat e një dokumenti. */
  async setTags(documentId, tagIds = []) {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');

    const { error: delError } = await supabase
      .from('document_tags')
      .delete()
      .eq('document_id', documentId);
    if (delError) throw new Error(translateError(delError));

    if (!tagIds.length) return;
    const { error } = await supabase.from('document_tags').insert(
      tagIds.map((tagId) => ({ document_id: documentId, tag_id: tagId, user_id: user.id }))
    );
    if (error) throw new Error(translateError(error));
  },

  /** URL e nënshkruar për shikim (me afat). */
  async signedUrl(storagePath, { download = false, expiresIn = APP.signedUrlTtl } = {}) {
    const options = download ? { download } : undefined;
    const { data, error } = await supabase.storage
      .from(APP.bucket)
      .createSignedUrl(storagePath, expiresIn, options);
    if (error) throw new Error(translateError(error));
    return data.signedUrl;
  },

  /** Shkarkon skedarin si Blob. */
  async download(storagePath) {
    const { data, error } = await supabase.storage.from(APP.bucket).download(storagePath);
    if (error) throw new Error(translateError(error));
    return data;
  },

  /** Regjistron veprimin e shkarkimit në historik. */
  async logDownload(documentId, label) {
    try {
      const user = await auth.getUser();
      if (!user) return;
      await supabase.from('activity_log').insert({
        user_id: user.id,
        action: 'downloaded',
        entity: 'document',
        entity_id: documentId,
        label
      });
    } catch {
      /* historiku është jo-kritik */
    }
  }
};

/* ======================================================= STATISTIKAT ====== */

export const stats = {
  async dashboard() {
    return check(await supabase.rpc('get_dashboard_stats'), 'Marrja e statistikave dështoi.') || {};
  },

  async activity(limit = 10) {
    return (
      check(
        await supabase
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        'Marrja e historikut dështoi.'
      ) || []
    );
  }
};

/* ======================================================== NJOFTIMET ======= */

export const notifications = {
  /** Gjeneron njoftimet e skadimit sipas cilësimeve të përdoruesit. */
  async sync() {
    const { data, error } = await supabase.rpc('sync_expiry_notifications');
    if (error) {
      console.warn('[DOKUMENT] Sinkronizimi i njoftimeve dështoi:', error.message);
      return 0;
    }
    return data || 0;
  },

  async list(limit = 30) {
    return (
      check(
        await supabase
          .from('notifications')
          .select('*, documents(id, title, expiry_date)')
          .order('is_read', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(limit),
        'Marrja e njoftimeve dështoi.'
      ) || []
    );
  },

  async unreadCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) return 0;
    return count || 0;
  },

  async markRead(id) {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw new Error(translateError(error));
  },

  async markAllRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
    if (error) throw new Error(translateError(error));
  },

  async remove(id) {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw new Error(translateError(error));
  },

  async clearAll() {
    const user = await auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (error) throw new Error(translateError(error));
  }
};

/* =========================================================== LLOGARIA ===== */

export const account = {
  /** Fshin të gjitha të dhënat dhe skedarët e përdoruesit. */
  async deleteAllData() {
    const user = await auth.getUser();
    if (!user) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');

    // 1. Largo skedarët nga Storage
    const { data: docs } = await supabase.from('documents').select('storage_path');
    const paths = (docs || []).map((row) => row.storage_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from(APP.bucket).remove(paths.slice(i, i + 100)).catch(() => {});
    }
    const { data: avatars } = await supabase.storage.from(APP.avatarBucket).list(user.id);
    if (avatars?.length) {
      await supabase.storage
        .from(APP.avatarBucket)
        .remove(avatars.map((a) => `${user.id}/${a.name}`))
        .catch(() => {});
    }

    // 2. Fshi rreshtat
    const result = check(await supabase.rpc('delete_all_my_data'), 'Fshirja dështoi.');
    return result;
  },

  /** Eksporton të dhënat e përdoruesit si JSON. */
  async exportData() {
    const [profile, cats, flds, tgs, docs, acts] = await Promise.all([
      profiles.get(),
      categories.list(),
      folders.list(),
      tags.list(),
      supabase
        .from('documents')
        .select('*, document_tags(tag:tags(name))')
        .order('created_at', { ascending: false }),
      stats.activity(200)
    ]);

    return {
      exported_at: new Date().toISOString(),
      application: 'DOKUMENT',
      version: APP.version,
      profile,
      categories: cats,
      folders: flds,
      tags: tgs,
      documents: (docs.data || []).map((doc) => ({
        ...doc,
        tags: (doc.document_tags || []).map((link) => link.tag?.name).filter(Boolean),
        document_tags: undefined
      })),
      activity: acts
    };
  }
};

export { supabase };
