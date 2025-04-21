import { createClient } from "@supabase/supabase-js";
export const supabaseUrl = "https://lqukbbygfnifsepiqbnl.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxdWtiYnlnZm5pZnNlcGlxYm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNTA2ODIsImV4cCI6MjA2MDcyNjY4Mn0.3Z1pk7-oJ814-WOvJT70Ve933K8XYs5GnBpDZi2D7Ns";
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
