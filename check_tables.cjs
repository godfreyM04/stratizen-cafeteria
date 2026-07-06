const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ubwkrnmhvfhshvoghjia.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVid2tybm1odmZoc2h2b2doamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjc2ODksImV4cCI6MjA5NzIwMzY4OX0.inYVIGBg2eqyHJhOYGnCUrAW76zTcO0i5RwnqQXaRsw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Checking profiles...');
  const { data: pData, error: pError } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles result:', { pData, pError });

  console.log('Checking menu...');
  const { data: mData, error: mError } = await supabase.from('menu').select('*').limit(1);
  console.log('Menu result:', { mData, mError });
}

check();
