const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ubwkrnmhvfhshvoghjia.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVid2tybm1odmZoc2h2b2doamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjc2ODksImV4cCI6MjA5NzIwMzY4OX0.inYVIGBg2eqyHJhOYGnCUrAW76zTcO0i5RwnqQXaRsw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyAndFixChef() {
  console.log('Signing in to chef account to verify profile...');
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'chef1@gmail.com',
    password: '12345678'
  });

  if (signInError) {
    console.error('Sign in failed:', signInError.message);
    return;
  }

  const userId = signInData.user.id;
  console.log('Signed in successfully. User ID:', userId);

  // Check if profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  if (profile) {
    console.log('Profile exists:', profile);
    if (profile.role !== 'chef') {
      console.log(`Profile role is '${profile.role}'. Updating to 'chef'...`);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'chef' })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Failed to update profile:', updateError);
      } else {
        console.log('Profile role updated to chef successfully.');
      }
    } else {
      console.log('Profile is already correctly configured as chef.');
    }
  } else {
    console.log('No profile found. Inserting profile record...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: 'Chef Anderson',
        student_number: 'CHEF001',
        email: 'chef1@gmail.com',
        role: 'chef'
      });

    if (insertError) {
      console.error('Failed to insert profile:', insertError);
    } else {
      console.log('Profile record inserted successfully.');
    }
  }

  // Verify wallet exists
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!wallet) {
    console.log('No wallet found for chef. Inserting wallet...');
    const { error: walletInsertError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        balance: 0.00
      });
    if (walletInsertError) {
      console.error('Failed to insert wallet:', walletInsertError);
    } else {
      console.log('Wallet inserted successfully.');
    }
  } else {
    console.log('Wallet verified.');
  }
}

verifyAndFixChef();
