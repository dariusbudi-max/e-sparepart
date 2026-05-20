
const SUPABASE_URL = "https://opwnpvjxiqydgqzozdyo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd25wdmp4aXF5ZGdxem96ZHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDY2NTYsImV4cCI6MjA5MTIyMjY1Nn0.dlK7iFPGTtX1bucJF3R25DMNnE8JORmcJdEbzEEApqk";

export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

