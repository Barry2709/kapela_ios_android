async function testLingva() {
  try {
    const res = await fetch('https://lingva.ml/api/v1/en/fr/Home');
    const json = await res.json();
    console.log('Lingva:', json.translation);
  } catch (e) {
    console.log('Lingva error:', e.message);
  }
}

async function testFT() {
  try {
    const res = await fetch('https://ftapi.pythonanywhere.com/translate?sl=en&dl=fr&text=Home');
    const json = await res.json();
    console.log('FT API:', json['destination-text']);
  } catch (e) {
    console.log('FT API error:', e.message);
  }
}

async function main() {
  await testLingva();
  await testFT();
}

main();
