import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgkkjmimtqipopnpyrci.supabase.co';
const supabaseKey = 'sb_publishable_VKieuEFkRt0qMf7w8jEqxw_tsgTvDb5';

export const supabase = createClient(supabaseUrl, supabaseKey);