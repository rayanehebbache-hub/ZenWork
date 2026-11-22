import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jefgjiihtfkwbizbdmvq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmdqaWlodGZrd2JpemJkbXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzQ2NjQsImV4cCI6MjA4NzExMDY2NH0.1FZmrHtzn7rKN5xv07VD5sCEjVvHQJphg14J3995EdA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
