async function test() {
  const items = ['Home', 'Events', 'Repertoire', 'Treasury', 'Band Settings', 'Add New Concert', 'Rehearsal Room'];
  const text = items.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(json[0].map(x => x[0]));
}
test();
