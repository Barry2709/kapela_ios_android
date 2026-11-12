async function test() {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent('Rehearsal Room')}&langpair=en|fr&de=devtest982@gmail.com`;
  const res = await fetch(url);
  const json = await res.json();
  console.log('MyMemory with email:', json.responseData.translatedText);
}
test();
