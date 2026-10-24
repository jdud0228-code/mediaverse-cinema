const API=(window.MEDIAVERSE_API_BASE||"https://two1mediaverse-cinema.onrender.com").replace(/\/$/,"");
const tg=window.Telegram?.WebApp;
let activeTab="home",query="",items=[],favorites=[],history=[],user=null;
const $=id=>document.getElementById(id);
const TITLES={home:["ПОДБОРКА ДНЯ","Выбери, что посмотреть"],movies:["КИНОТЕКА","Фильмы"],series:["СЕРИАЛЫ","Сериалы"],anime:["МИР АНИМЕ","Аниме"],youtube:["ВИДЕО","YouTube"],tiktok:["КОРОТКИЕ ВИДЕО","TikTok"],favorites:["ТВОЯ КОЛЛЕКЦИЯ","Избранное"],history:["НЕДАВНО ОТКРЫТО","История"],profile:["ТВОЙ АККАУНТ","Профиль"],vpn:["ПОДКЛЮЧЕНИЕ","VPN и маршрутизация"]};
const localKey=k=>"mv_"+k;
function localGet(k){try{return JSON.parse(localStorage.getItem(localKey(k))||"[]")}catch{return []}}
function localSet(k,v){localStorage.setItem(localKey(k),JSON.stringify(v))}
async function api(path,opts={}){if(!API)throw Error("API_BASE_URL не настроен");const headers={"Content-Type":"application/json",...(opts.headers||{})};if(tg?.initData)headers["X-Telegram-Init-Data"]=tg.initData;const r=await fetch(API+path,{...opts,headers});if(!r.ok)throw Error(await r.text());return r.json()}

async function init(){
  if(tg){
    tg.ready();
    tg.expand();
  }

  try {
    items = await api("/api/catalog");
  } catch(e) {
    console.error("Ошибка загрузки каталога:", e);
    items = [];
  }

  try {
    if(tg?.initData) {
      user = await api("/api/me");
      favorites = await api("/api/favorites");
      history = await api("/api/history");
    } else {
      favorites = localGet("favorites");
      history = localGet("history");
    }
  } catch(e) {
    favorites = localGet("favorites");
    history = localGet("history");
  }

  render();
}

function kindFilter(tab,x){if(tab==="movies")return x.kind==="movie";if(tab==="series")return x.kind==="series";if(tab==="anime")return x.kind==="anime";if(tab==="youtube")return x.kind==="youtube";if(tab==="tiktok")return x.kind==="tiktok";return true}
function render(){const t=TITLES[activeTab]||TITLES.home;$("eyebrow").textContent=t[0];$("sectionTitle").textContent=t[1];const q=query.trim().toLowerCase();let list=items.filter(x=>kindFilter(activeTab,x));if(activeTab==="favorites")list=items.filter(x=>favorites.includes(x.id));if(activeTab==="history")list=history.map(id=>items.find(x=>x.id===id)).filter(Boolean);if(activeTab==="home")list=list.slice(0,9);if(q)list=list.filter(x=>(x.title+" "+(x.description||"")+" "+x.kind).toLowerCase().includes(q));
if(activeTab==="profile"){$("content").innerHTML=`<section class="panel"><h3>Профиль MediaVerse</h3><p>Пользователь: ${esc(user?.first_name||tg?.initDataUnsafe?.user?.first_name||"Telegram")}</p><p>Избранное синхронизируется с сервером после настройки API и запуска из Telegram. В демо-режиме данные сохраняются на этом устройстве.</p><p>В избранном: ${favorites.length} · В истории: ${history.length}</p></section>`;$("empty").classList.add("hidden");$("resultCount").textContent="";return}
if(activeTab==="vpn"){$("content").innerHTML=`<section class="panel"><h3>🛡 VPN для YouTube и TikTok</h3><div class="notice">Mini App не может включить VPN или изменить сетевые маршруты устройства. Настройка выполняется отдельно в StealthSurf VPN/совместимом клиенте. Не публикуй личную ссылку подписки.</div><ol><li>Windows: если клиент поддерживает split tunneling, задай прямой маршрут по умолчанию и правила YouTube/TikTok через VPN.</li><li>Android: выбери только приложения YouTube и TikTok в настройках приложений VPN, если функция доступна.</li><li>Проверь доступ к обоим сервисам и обычным сайтам/приложениям.</li></ol></section>`;$("empty").classList.add("hidden");$("resultCount").textContent="";return}
$("content").innerHTML=list.map(card).join("");$("resultCount").textContent=list.length+" элементов";$("empty").classList.toggle("hidden",list.length!==0)}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function card(x){return `<article class="card"><div class="card-top"><div class="art">${x.kind==="anime"?"🍥":x.kind==="series"?"📺":x.kind==="youtube"?"▶️":x.kind==="tiktok"?"♪":"🎬"}</div><span class="tag">${esc(x.kind).toUpperCase()}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><div class="actions"><button class="open-btn" data-play="${esc(x.id)}">Смотреть ▶</button><button class="save-btn" data-save="${esc(x.id)}">${favorites.includes(x.id)?"♥":"♡"}</button></div></article>`}
async function toggleFavorite(id){const has=favorites.includes(id);if(has)favorites=favorites.filter(x=>x!==id);else favorites.unshift(id);localSet("favorites",favorites);try{if(has)await api("/api/favorites/"+encodeURIComponent(id),{method:"DELETE"});else await api("/api/favorites",{method:"POST",body:JSON.stringify({item_id:id})});favorites=await api("/api/favorites")}catch(e){}render()}
async function play(id){const x=items.find(a=>a.id===id);if(!x)return;history=[id,...history.filter(a=>a!==id)].slice(0,100);localSet("history",history);try{await api("/api/history",{method:"POST",body:JSON.stringify({item_id:id})});history=await api("/api/history")}catch(e){}
$("playerTitle").textContent=x.title;$("playerDescription").textContent=x.description||"";const v=$("videoPlayer"),embed=$("embedPlayer");v.pause();v.removeAttribute("src");v.load();embed.innerHTML="";if(x.video_url){v.src=x.video_url;v.classList.remove("hidden");}else if(x.embed_url){v.classList.add("hidden");let frame=document.createElement("iframe");frame.src=x.embed_url;frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";frame.style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px";embed.appendChild(frame)}else{v.classList.add("hidden");embed.innerHTML='<p class="notice">Для этого элемента ещё не добавлен разрешённый video_url или embed_url. Добавьте лицензированный источник в каталог на сервере.</p>'}
$("playerModal").classList.remove("hidden")}
function closePlayer(){$("videoPlayer").pause();$("videoPlayer").removeAttribute("src");$("videoPlayer").load();$("embedPlayer").innerHTML="";$("playerModal").classList.add("hidden")}
$("tabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b){activeTab=b.dataset.tab;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));render()}});
$("content").addEventListener("click",e=>{const p=e.target.closest("[data-play]"),s=e.target.closest("[data-save]");if(p)play(p.dataset.play);if(s)toggleFavorite(s.dataset.save)});
$("searchInput").addEventListener("input",e=>{query=e.target.value;if(query)activeTab="home";render()});$("clearSearch").addEventListener("click",()=>{$("searchInput").value="";query="";render()});$("profileShortcut").addEventListener("click",()=>{activeTab="profile";render()});$("closePlayer").addEventListener("click",closePlayer);$("playerModal").addEventListener("click",e=>{if(e.target===$("playerModal"))closePlayer()});
init();
