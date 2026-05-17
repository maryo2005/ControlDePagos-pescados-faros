import fetch from 'node-fetch'; // or we can use global fetch if node is v18+
async function run() {
  try {
    const res = await fetch('https://brfefndsnfysavlrdgum.supabase.co/rest/v1/registros?limit=1', {
      headers: {
        'apikey': 'sb_publishable_MULS0C14df7CBDIUf4WOxg_d6st7p5P',
        'Authorization': 'Bearer sb_publishable_MULS0C14df7CBDIUf4WOxg_d6st7p5P'
      }
    });
    const data = await res.json();
    console.log('Registros columns:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
