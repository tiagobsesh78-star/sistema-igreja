import { createClient } from '@supabase/supabase-js';

// Colocando as chaves diretamente para ignorar o cache do Next.js
const supabaseUrl = 'https://hzkmgmghdgnxfqgeooch.supabase.co';
const supabaseKey = 'sb_publishable_5cyVRNIwu3HJIfN_PTKPlQ_K06_hmR4';

export const supabase = createClient(supabaseUrl, supabaseKey);