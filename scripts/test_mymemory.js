async function test() {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent('Home')}&langpair=en|es`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(json.responseData.translatedText);
}
test();
