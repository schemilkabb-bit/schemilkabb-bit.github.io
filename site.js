// Language switch: remembers the visitor's choice, defaults to English for non-Slovak browsers.
const root = document.documentElement;
function setLang(lang) {
  root.dataset.lang = lang;
  root.lang = lang;
  document.querySelectorAll('[data-set-lang]').forEach(b => b.classList.toggle('on', b.dataset.setLang === lang));
  try { localStorage.setItem('lang', lang); } catch (e) {}
}
let saved = null;
try { saved = localStorage.getItem('lang'); } catch (e) {}
setLang(saved || (/^(sk|cs)/i.test(navigator.language) ? 'sk' : 'en'));
document.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));

// Design gallery: banners exported from Bannerovač live in work/banners/.
const countries = ['sk', 'cz', 'pl', 'at', 'hu', 'hr', 'si', 'ro'];
const campaign = document.getElementById('campaign');
countries.forEach(cc => {
  campaign.insertAdjacentHTML('beforeend',
    `<figure><img src="work/banners/ig-458-${cc}.png" alt="1+1 ${cc.toUpperCase()}" loading="lazy"><figcaption>${cc.toUpperCase()}</figcaption></figure>`);
});
const posts = document.getElementById('posts');
['3710', '8574', '25025'].forEach(code => {
  posts.insertAdjacentHTML('beforeend', `<figure><img src="work/banners/ig-${code}-sk.png" alt="" loading="lazy"></figure>`);
});
