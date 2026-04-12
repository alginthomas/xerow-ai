// Test Supabase Auth Configuration
const testAuth = async () => {
  console.log('=== Supabase Auth Diagnostic ===\n');
  
  // Check environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta?.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta?.env?.VITE_SUPABASE_ANON_KEY;
  
  console.log('1. Environment Variables:');
  console.log('   VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing');
  console.log('');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('❌ Missing required environment variables!');
    return;
  }
  
  // Test Supabase connection
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('2. Testing Supabase Connection:');
    const { data: health, error: healthError } = await supabase.from('_health').select('*').limit(1);
    if (healthError && healthError.code !== 'PGRST116') {
      console.log('   Connection:', '✗ Failed -', healthError.message);
    } else {
      console.log('   Connection:', '✓ OK');
    }
    console.log('');
    
    // Test sign in with test account
    console.log('3. Testing Authentication:');
    const testEmail = 'customer@xerow.ai';
    const testPassword = 'customer123';
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      console.log('   Sign In:', '✗ Failed -', signInError.message);
      console.log('   Error Code:', signInError.status);
    } else {
      console.log('   Sign In:', '✓ Success');
      console.log('   User ID:', signInData.user?.id);
      console.log('   Session:', signInData.session ? '✓ Active' : '✗ Missing');
      
      // Test profile fetch
      if (signInData.session?.access_token) {
        const functionUrl = `${supabaseUrl}/functions/v1`;
        const response = await fetch(`${functionUrl}/make-server-bffba348/user/profile`, {
          headers: {
            'Authorization': `Bearer ${signInData.session.access_token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const profile = await response.json();
          console.log('   Profile Fetch:', '✓ Success');
          console.log('   User Role:', profile.user?.role || 'N/A');
        } else {
          console.log('   Profile Fetch:', '✗ Failed -', response.status, response.statusText);
          const errorText = await response.text();
          console.log('   Error Details:', errorText.substring(0, 200));
        }
      }
    }
    console.log('');
    
    // Test Edge Function health
    console.log('4. Testing Edge Function:');
    const functionUrl = `${supabaseUrl}/functions/v1`;
    const healthResponse = await fetch(`${functionUrl}/make-server-bffba348/health`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   Health Check:', '✓ OK');
      console.log('   Supabase Config:', healthData.supabase?.configured ? '✓' : '✗');
      console.log('   Version:', healthData.version || 'N/A');
    } else {
      console.log('   Health Check:', '✗ Failed -', healthResponse.status);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error.stack);
  }
};

// Run if in Node.js
if (typeof window === 'undefined') {
  testAuth();
} else {
  // Export for browser use
  window.testAuth = testAuth;
}
