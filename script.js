
const FX = { usd_iqd: 1350, kwd_usd: 3.25 };
const SITE = { codePrefix: 'SH-' };
const $ = (s)=>document.querySelector(s);
function fmt(n){ return Number(n).toLocaleString('en-US', {maximumFractionDigits:2}); }
document.addEventListener('DOMContentLoaded', ()=>{ const y=$('#year'); if(y) y.textContent=new Date().getFullYear(); });

// Fetch real cart via serverless function
document.addEventListener('DOMContentLoaded', ()=>{
  const cartForm = document.getElementById('cartForm');
  if (!cartForm) return;
  cartForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const u = document.getElementById('cartUrl').value.trim();
    const btn = cartForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الجلب...';
    try {
      const res = await fetch(`/api/get-cart?url=${encodeURIComponent(u)}`);
      if (!res.ok) throw new Error('خطأ في الجلب');
      const cart = await res.json();
      renderCart(cart);
      localStorage.setItem('currentCart', JSON.stringify(cart));
    } catch(err){
      alert('ما قدرنا نجلب السلة. تأكد من الرابط وجرب مرة ثانية.');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'تحميل السلة';
    }
  });
});

function renderCart(cart){
  const wrap = document.getElementById('cartCard');
  const itemsBox = document.getElementById('items');
  let sumUsd = 0;
  itemsBox.innerHTML = '';
  (cart.items||[]).forEach(it=>{
    sumUsd += it.price_usd * it.qty;
    const iqd = Math.round(it.price_usd * FX.usd_iqd);
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <img src="${it.image||''}" alt="">
      <div>
        <div>${it.title||'-'}</div>
        <div class="muted small">العدد: ${it.qty} • السعر: ${fmt(it.price_usd)} USD</div>
      </div>
      <div class="price"><strong>${fmt(iqd)}</strong> IQD</div>
    `;
    itemsBox.appendChild(el);
  });
  const sumIqd = Math.round(sumUsd * FX.usd_iqd);
  document.getElementById('sumUsd').textContent = fmt(sumUsd);
  document.getElementById('sumIqd').textContent = fmt(sumIqd);
  wrap.style.display = 'block';
}

// Payment page
document.addEventListener('DOMContentLoaded', ()=>{
  const payForm = document.getElementById('payForm');
  if (!payForm) return;
  payForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const cart = JSON.parse(localStorage.getItem('currentCart')||'{"items":[]}');
    const code = SITE.codePrefix + Math.floor(10000 + Math.random()*89999);
    const method = document.getElementById('payMethod').value;
    const orders = JSON.parse(localStorage.getItem('orders')||'[]');
    orders.push({code, method, cart, status:'processing', createdAt: new Date().toISOString()});
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('lastOrderCode', code);
    location.href = 'success.html';
  });
});

// Success page
document.addEventListener('DOMContentLoaded', ()=>{
  const codeEl = document.getElementById('code');
  if (!codeEl) return;
  const code = localStorage.getItem('lastOrderCode') || SITE.codePrefix + '00000';
  codeEl.textContent = code;
  const cart = JSON.parse(localStorage.getItem('currentCart')||'{"items":[]}');
  const list = (cart.items||[]).map(it=>`<li>${it.title||'-'} × ${it.qty}</li>`).join('');
  document.getElementById('summary').innerHTML = `<p>الملخص:</p><ul>${list}</ul>`;
});

// Tracking
document.addEventListener('DOMContentLoaded', ()=>{
  const trackForm = document.getElementById('trackForm');
  if (!trackForm) return;
  trackForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const code = document.getElementById('trackCode').value.trim();
    const local = JSON.parse(localStorage.getItem('orders')||'[]');
    const found = local.find(o=>o.code.toUpperCase()===code.toUpperCase());
    const card = document.getElementById('statusCard');
    const text = document.getElementById('statusText');
    const tl = document.getElementById('timeline');
    if (found) {
      card.style.display = 'block';
      text.innerHTML = `<span class="badge">قيد المراجعة</span>`;
      tl.innerHTML = '<div>✅ قيد المراجعة</div>';
    } else {
      card.style.display = 'block';
      text.innerHTML = 'ماكو طلب بهالكود';
      tl.innerHTML = '';
    }
  });
});
