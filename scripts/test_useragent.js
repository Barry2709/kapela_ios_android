async function test() {
  const url = `https://translate.googleapis.com/translate_a/single?client=dict_chrome_ex&sl=en&tl=fr&dt=t&q=${encodeURIComponent('Home\nEvents\nRepertoire\nTreasury\nBand Settings')}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const text = await res.text();
  console.log(text.slice(0, 200));
}
test();
