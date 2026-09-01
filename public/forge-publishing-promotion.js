/* Author's Forge Publishing + Promotion Office. Server remains the durable authority. */
(() => {
  'use strict';
  const projectId = new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || 'forge-studio';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const rootUrl = (suffix = '') => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const state = { bookId: '', marketReports: [], campaigns: [], activeCampaignId: '' };

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'content-type':'application/json', ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }
  function message(text, ok = false) {
    const target = ok ? $('#success-banner') : $('#error-banner');
    if (!target) return;
    target.textContent = text;
    target.hidden = false;
    const other = ok ? $('#error-banner') : $('#success-banner');
    if (other) other.hidden = true;
    if (ok) setTimeout(() => { target.hidden = true; }, 4500);
  }
  const lines = (value) => String(value || '').split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
  const checkedValues = (name, root = document) => $$(`input[name="${name}"]:checked`, root).map((el) => el.value);
  const numberOrUndefined = (value) => String(value ?? '').trim() === '' ? undefined : Number(value);

  function books() { return window.forgeWorkspaceState?.books || []; }
  function activeBook() { return books().find((b) => b.id === state.bookId) || books().find((b) => b.id === window.forgeWorkspaceState?.activeBookId) || books()[0]; }
  function bookOptions() { return books().map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join('') || '<option value="">Create a book first</option>'; }

  function ensurePanels() {
    const publishing = $('#publishing');
    const marketing = $('#marketing');
    if (publishing && !$('#forge-publishing-office')) {
      const office = document.createElement('div');
      office.id = 'forge-publishing-office';
      office.innerHTML = `
        <div class="grid">
          <article class="card">
            <div class="eyebrow">PUBLISHING METADATA</div><h3>KDP metadata authority</h3>
            <p class="muted">Save durable book metadata, validate KDP constraints, and preserve revision history. Market research never changes these fields without your approval.</p>
            <form id="publishing-metadata-form">
              <label>Book<select id="publishing-book" name="bookId" required></select></label>
              <label>Title<input name="title" required></label>
              <label>Subtitle<input name="subtitle"></label>
              <label>Series<input name="seriesName"></label>
              <label>Author<input name="author" required></label>
              <label>Description<textarea name="description" required maxlength="4000" rows="7"></textarea></label>
              <label>Keywords — one per line, max 7<textarea name="keywords" rows="5"></textarea></label>
              <label>Categories — one per line, max 3<textarea name="categories" rows="4"></textarea></label>
              <div class="row"><label>Audience<select name="primaryAudience"><option value="general">General</option><option value="children">Children</option><option value="teen">Teen</option></select></label><label>Reading age min<input name="readingAgeMin" type="number" min="0" max="17"></label><label>Max<input name="readingAgeMax" type="number" min="0" max="17"></label></div>
              <div class="row"><label>Marketplace<input name="primaryMarketplace" value="Amazon.com" required></label><label>Language<input name="language" value="English" required></label></div>
              <fieldset><legend>Formats</legend><label><input type="checkbox" name="publishing-format" value="ebook" checked> eBook</label><label><input type="checkbox" name="publishing-format" value="paperback"> Paperback</label><label><input type="checkbox" name="publishing-format" value="hardcover"> Hardcover</label></fieldset>
              <div class="row"><label>ISBN strategy<select name="isbnStrategy"><option value="not-applicable">Not applicable</option><option value="kdp-free">KDP free ISBN</option><option value="owned">Owned ISBN</option></select></label><label>ISBN<input name="isbn"></label></div>
              <fieldset><legend>AI content classification</legend><label>Text<select name="aiText"><option value="none">None</option><option value="assisted">AI-assisted</option><option value="generated">AI-generated</option></select></label><label>Images<select name="aiImages"><option value="none">None</option><option value="assisted">AI-assisted</option><option value="generated">AI-generated</option></select></label><label>Translations<select name="aiTranslations"><option value="none">None</option><option value="assisted">AI-assisted</option><option value="generated">AI-generated</option></select></label></fieldset>
              <button class="primary" type="submit">Save publishing metadata</button>
            </form>
            <div id="publishing-compliance" class="list"></div>
          </article>
          <article class="card">
            <div class="eyebrow">RELEASE READINESS</div><h3>Publishing evidence audit</h3>
            <p class="muted">Forge derives book/metadata/cover-plan facts and combines them with the production evidence you confirm here. Warnings stay visible; error-severity failures block release.</p>
            <form id="publishing-readiness-form">
              <div class="row"><label>Page count<input name="pageCount" type="number" min="1"></label><label>Output file types<input name="fileTypes" placeholder="pdf, epub"></label></div>
              <fieldset><legend>Manuscript/front matter</legend><label><input type="checkbox" name="hasTitlePage"> Title page</label><label><input type="checkbox" name="hasCopyrightPage"> Copyright page</label><label><input type="checkbox" name="hasTableOfContents"> Table of contents</label><label><input type="checkbox" name="hasDedication"> Dedication</label><label><input type="checkbox" name="hasAboutTheAuthor"> About author</label><label><input type="checkbox" name="hasBackMatter"> Back matter</label></fieldset>
              <fieldset><legend>Production validation</legend><label><input type="checkbox" name="formattingValidated"> Formatting validated</label><label><input type="checkbox" name="pageNumbering"> Page numbering configured</label><label><input type="checkbox" name="headersFooters"> Headers/footers configured or deliberately omitted</label><label><input type="checkbox" name="imagesResolved"> Image references resolved</label><label><input type="checkbox" name="imagesApproved"> Images approved</label><label><input type="checkbox" name="resolutionValidated"> Image resolution validated</label><label><input type="checkbox" name="productionTrim"> Trim validated</label><label><input type="checkbox" name="productionBleed"> Bleed validated</label><label><input type="checkbox" name="productionValidated"> Final production validation passed</label></fieldset>
              <button id="run-publishing-readiness" type="submit">Run Publishing readiness</button>
            </form>
            <div id="publishing-readiness-result" class="list"></div>
            <button id="run-release-gate" type="button" class="primary">Check combined release gate</button>
            <div id="release-gate-result" class="list"></div>
          </article>
        </div>`;
      publishing.prepend(office);
    }
    if (marketing && !$('#forge-promotion-office')) {
      const office = document.createElement('div');
      office.id = 'forge-promotion-office';
      office.innerHTML = `
        <div class="grid">
          <article class="card">
            <div class="eyebrow">LIVE MARKET RESEARCH</div><h3>Market Research & Keyword Finder</h3>
            <p>Research current market signals, comparable titles, observable statistics, niches, and reader-search keyword phrases. Forge does not convert BSR/reviews into fake sales numbers.</p>
            <label>Book<select id="market-book"></select></label>
            <label>Marketplace<input id="market-marketplace" value="Amazon.com / United States"></label>
            <label>Research question<textarea id="market-question" rows="4" placeholder="Find current opportunities, competition, comparable titles, and KDP keyword phrases for this book."></textarea></label>
            <div class="row"><button id="run-market-research" class="primary" type="button">Run live market research</button><button id="refresh-market-research" type="button">Load saved research</button></div>
            <p id="market-status" class="muted">Live research requires a configured OpenAI market-research model and API key.</p>
            <div id="market-report" class="list"></div>
          </article>
          <article class="card">
            <div class="eyebrow">PROMOTION CAMPAIGN</div><h3>AI launch builder</h3>
            <p class="muted">AI creates complete draft assets from the real book, publishing metadata, and saved research. Nothing self-approves or self-publishes.</p>
            <form id="promotion-generate-form">
              <label>Objective<textarea name="objective" required>Prepare an accurate, reader-focused launch campaign.</textarea></label>
              <label>Audience<textarea name="audience" required placeholder="Who should this book reach?"></textarea></label>
              <label>Reader promise<textarea name="readerPromise" required placeholder="What experience does the book genuinely deliver?"></textarea></label>
              <fieldset><legend>Channels</legend>
                <label><input type="checkbox" name="promotion-channel" value="social" checked> Social</label><label><input type="checkbox" name="promotion-channel" value="email"> Email</label><label><input type="checkbox" name="promotion-channel" value="author-site"> Author site</label><label><input type="checkbox" name="promotion-channel" value="reader-community"> Reader community</label><label><input type="checkbox" name="promotion-channel" value="press"> Press</label><label><input type="checkbox" name="promotion-channel" value="retailer"> Retailer copy</label><label><input type="checkbox" name="promotion-channel" value="amazon-ads"> Amazon Ads</label><label><input type="checkbox" name="promotion-channel" value="a-plus"> A+ Content</label>
              </fieldset>
              <label>Launch date<input name="launchDate" type="datetime-local"></label>
              <button class="primary" type="submit">Generate real AI campaign</button>
            </form>
            <div class="row"><button id="refresh-campaigns" type="button">Load campaigns</button><button id="promotion-readiness" type="button">Run Promotion readiness</button></div>
            <div id="promotion-readiness-result" class="list"></div>
            <div id="promotion-campaigns" class="list"></div>
          </article>
        </div>`;
      marketing.prepend(office);
    }
    bind();
    syncBooks();
  }

  function syncBooks() {
    const options = bookOptions();
    ['#publishing-book','#market-book'].forEach((selector) => { const el=$(selector); if(el){ const previous=el.value; el.innerHTML=options; if(previous && books().some((b)=>b.id===previous)) el.value=previous; } });
    const selected = $('#publishing-book')?.value || $('#market-book')?.value || activeBook()?.id || '';
    if (selected) selectBook(selected, false);
  }

  async function selectBook(bookId, load = true) {
    state.bookId = bookId;
    ['#publishing-book','#market-book'].forEach((selector)=>{const el=$(selector);if(el && el.value!==bookId)el.value=bookId;});
    if (!load || !bookId) return;
    await Promise.allSettled([loadPublishingMetadata(), loadMarketResearch(), loadCampaigns(), loadPublishingReadiness()]);
  }

  async function loadPublishingMetadata() {
    if (!state.bookId) return;
    const form = $('#publishing-metadata-form'); if (!form) return;
    const current = await api(rootUrl(`/publishing/metadata?bookId=${encodeURIComponent(state.bookId)}`));
    const m = current?.metadata;
    if (!m) { const book=activeBook(); form.elements.title.value=book?.title||''; return; }
    for (const key of ['title','subtitle','seriesName','author','description','primaryMarketplace','language','isbn']) if (form.elements[key]) form.elements[key].value=m[key]||'';
    form.elements.keywords.value=(m.keywords||[]).join('\n'); form.elements.categories.value=(m.categories||[]).join('\n');
    form.elements.primaryAudience.value=m.primaryAudience||'general'; form.elements.readingAgeMin.value=m.readingAge?.min??''; form.elements.readingAgeMax.value=m.readingAge?.max??''; form.elements.isbnStrategy.value=m.isbnStrategy||'not-applicable';
    $$('input[name="publishing-format"]',form).forEach((el)=>{el.checked=(m.formats||[]).includes(el.value);});
    form.elements.aiText.value=m.aiContent?.text||'none'; form.elements.aiImages.value=m.aiContent?.images||'none'; form.elements.aiTranslations.value=m.aiContent?.translations||'none';
    renderCompliance(current);
  }

  function renderCompliance(current) {
    const target=$('#publishing-compliance'); if(!target)return;
    const issues=current?.compliance?.issues||[];
    target.innerHTML=`<article class="memory"><strong>${current?.compliance?.ready?'Metadata passes current checks':'Metadata needs attention'}</strong><p>${current?.kdpAiDisclosureRequired?'KDP AI-generated content disclosure required.':'No KDP AI-generated disclosure indicated by the saved classification.'}</p></article>`+(issues.length?issues.map((issue)=>`<article class="memory"><strong>${esc(issue.severity)} • ${esc(issue.id)}</strong><p>${esc(issue.message)}</p>${issue.remediation?`<small>${esc(issue.remediation)}</small>`:''}</article>`).join(''):'<p class="muted">No metadata compliance findings.</p>');
  }

  async function savePublishingMetadata(event) {
    event.preventDefault(); const form=event.currentTarget; const formats=checkedValues('publishing-format',form); const min=numberOrUndefined(form.elements.readingAgeMin.value),max=numberOrUndefined(form.elements.readingAgeMax.value);
    try {
      const result=await api(rootUrl('/publishing/metadata'),{method:'POST',body:JSON.stringify({bookId:state.bookId,metadata:{title:form.elements.title.value,subtitle:form.elements.subtitle.value||undefined,seriesName:form.elements.seriesName.value||undefined,author:form.elements.author.value,contributors:[],description:form.elements.description.value,keywords:lines(form.elements.keywords.value),categories:lines(form.elements.categories.value),primaryAudience:form.elements.primaryAudience.value,...(min!==undefined||max!==undefined?{readingAge:{min:min??0,max:max??min??0}}:{}),primaryMarketplace:form.elements.primaryMarketplace.value,language:form.elements.language.value,formats,isbnStrategy:form.elements.isbnStrategy.value,isbn:form.elements.isbn.value||undefined,lowContent:false,aiContent:{text:form.elements.aiText.value,images:form.elements.aiImages.value,translations:form.elements.aiTranslations.value}}})});
      renderCompliance(result); message('Publishing metadata saved as a durable revision.',true);
    } catch(e){message(e.message);}
  }

  async function runPublishingReadiness(event) {
    event.preventDefault(); const form=event.currentTarget; const files=lines(form.elements.fileTypes.value); const imageCount=window.forgeWorkspaceState?.books?.find((b)=>b.id===state.bookId)?.kind==='childrens-book'?1:0;
    try { const report=await api(rootUrl('/publishing/readiness'),{method:'POST',body:JSON.stringify({bookId:state.bookId,evidence:{manuscript:{pageCount:numberOrUndefined(form.elements.pageCount.value),hasTitlePage:form.elements.hasTitlePage.checked,hasCopyrightPage:form.elements.hasCopyrightPage.checked,hasTableOfContents:form.elements.hasTableOfContents.checked,hasDedication:form.elements.hasDedication.checked,hasAboutTheAuthor:form.elements.hasAboutTheAuthor.checked,hasBackMatter:form.elements.hasBackMatter.checked},formatting:{fileTypes:files,validated:form.elements.formattingValidated.checked,pageNumbering:form.elements.pageNumbering.checked,headersFooters:form.elements.headersFooters.checked},images:{count:imageCount,allResolved:form.elements.imagesResolved.checked,allApproved:form.elements.imagesApproved.checked,resolutionValidated:form.elements.resolutionValidated.checked},production:{trim:form.elements.productionTrim.checked,bleed:form.elements.productionBleed.checked,fileTypes:files,validated:form.elements.productionValidated.checked}}})}); renderPublishingReadiness(report); message('Publishing readiness report saved.',true);}catch(e){message(e.message);}
  }
  async function loadPublishingReadiness(){if(!state.bookId)return;try{const data=await api(rootUrl(`/publishing/readiness?bookId=${encodeURIComponent(state.bookId)}`));if(data.reports?.[0])renderPublishingReadiness(data.reports[0]);}catch{}}
  function renderPublishingReadiness(report){const target=$('#publishing-readiness-result');if(!target)return;const errors=(report.checks||[]).filter((c)=>c.status==='attention'&&c.severity==='error').length,warnings=(report.checks||[]).filter((c)=>c.status==='attention'&&c.severity==='warning').length;target.innerHTML=`<article class="memory"><strong>${errors?`${errors} release blocker(s)`:'No error-severity blockers in this report'}</strong><p>${warnings} warning(s) remain visible.</p></article>`+(report.checks||[]).filter((c)=>c.status==='attention').map((c)=>`<article class="memory"><strong>${esc(c.severity)} • ${esc(c.label)}</strong><p>${esc(c.remediation||c.message)}</p></article>`).join('');}

  async function loadMarketResearch(){if(!state.bookId)return;try{const data=await api(rootUrl(`/market-research?bookId=${encodeURIComponent(state.bookId)}`));state.marketReports=data.reports||[];renderMarketReport(state.marketReports[0]);}catch(e){$('#market-status').textContent=e.message;}}
  async function runMarketResearch(){const button=$('#run-market-research');if(button)button.disabled=true;try{const result=await api(rootUrl('/market-research'),{method:'POST',body:JSON.stringify({bookId:state.bookId,market:$('#market-marketplace').value,question:$('#market-question').value||'Find current market opportunities, comparable titles, competition, reader expectations, and KDP keyword phrases for this book.'})});state.marketReports=[result,...state.marketReports];renderMarketReport(result);message('Live market research completed and saved with its source evidence.',true);}catch(e){message(e.message);$('#market-status').textContent=e.message;}finally{if(button)button.disabled=false;}}
  function renderMarketReport(entry){const target=$('#market-report');if(!target)return;if(!entry){target.innerHTML='<p class="muted">No saved market research for this book.</p>';return;}const report=entry.report||entry,stats=entry.statistics||{};const keywords=report.keywordRecommendations||[],niches=report.nicheOpportunities||[],evidence=report.evidence||[],comps=report.comparableTitles||[];target.innerHTML=`<article class="memory"><strong>${esc(report.market)} • ${esc(new Date(report.researchedAt).toLocaleString())}</strong><p>${esc(report.assessment?.rationale||'')}</p><small>${esc(report.assessment?.disclaimer||'')}</small></article><div class="metrics">${[['Sampled titles',stats.sampledTitles??comps.length],['Median price',stats.medianPrice??'—'],['Median BSR',stats.medianBestSellerRank??'—'],['Median reviews',stats.medianReviewCount??'—'],['Recent titles',stats.publishedWithin365Days??'—']].map(([k,v])=>`<div class="metric"><strong>${esc(v)}</strong><span>${esc(k)}</span></div>`).join('')}</div><h4>Ranked niches</h4>${niches.map((n)=>`<article class="memory"><strong>${esc(n.score)} • ${esc(n.niche)}</strong><p>${esc(n.rationale)}</p><small>Demand ${esc(n.demandSignal)} • competition ${esc(n.competitionSignal)}</small></article>`).join('')||'<p class="muted">No niche candidates.</p>'}<h4>KDP keyword candidates</h4><div id="market-keyword-options">${keywords.map((k)=>`<label class="memory"><input type="checkbox" name="market-keyword" value="${esc(k.phrase)}" ${k.recommendedForKdpSlot?'checked':''}> <strong>${esc(k.score)} • ${esc(k.phrase)}</strong><span>${esc(k.rationale)}</span></label>`).join('')}</div><button id="apply-market-keywords" type="button">Apply selected keywords to Publishing</button><h4>Comparable sample</h4>${comps.slice(0,12).map((c)=>`<article class="memory"><strong>${esc(c.title)}</strong><p>${c.price!==undefined?`$${esc(c.price)} `:''}${c.bestSellerRank!==undefined?`• BSR ${esc(c.bestSellerRank)} `:''}${c.reviewCount!==undefined?`• ${esc(c.reviewCount)} reviews `:''}${c.rating!==undefined?`• ${esc(c.rating)}★`:''}</p><small>${esc(c.category||c.genre||'')} ${c.publishedDate?`• ${esc(c.publishedDate)}`:''}</small></article>`).join('')||'<p class="muted">No comparable-title facts were safely observable.</p>'}<h4>Sources</h4>${evidence.map((e)=>`<article class="memory"><strong>${esc(e.source)}</strong><p>${esc(e.observation)}</p>${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Open source</a>`:''}</article>`).join('')}`;$('#market-status').textContent=`Saved report ${report.id}. Statistics describe only the observed sample; they are not unit-sales estimates.`;$('#apply-market-keywords')?.addEventListener('click',()=>applyMarketKeywords(report.id));$$('input[name="market-keyword"]',target).forEach((el)=>el.addEventListener('change',enforceKeywordLimit));}
  function enforceKeywordLimit(){const selected=$$('input[name="market-keyword"]:checked');if(selected.length<=7)return;this.checked=false;message('KDP supports up to seven keyword phrases.');}
  async function applyMarketKeywords(reportId){const phrases=$$('input[name="market-keyword"]:checked').map((el)=>el.value);if(!phrases.length)return message('Select at least one researched keyword phrase.');if(phrases.length>7)return message('Select no more than seven keyword phrases.');if(!window.confirm(`Apply ${phrases.length} evidence-backed keyword phrase(s) to this book's Publishing metadata?`))return;try{const result=await api(rootUrl('/market-research/apply-keywords'),{method:'POST',body:JSON.stringify({bookId:state.bookId,reportId,phrases,authorApproved:true})});renderCompliance(result);await loadPublishingMetadata();message('Selected market keywords applied as a new Publishing metadata revision.',true);}catch(e){message(e.message);}}

  async function generatePromotion(event){event.preventDefault();const form=event.currentTarget,channels=checkedValues('promotion-channel',form);if(!channels.length)return message('Select at least one promotion channel.');const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const latest=state.marketReports[0]?.report||state.marketReports[0];const result=await api(rootUrl('/promotion/generate'),{method:'POST',body:JSON.stringify({bookId:state.bookId,objective:form.elements.objective.value,audience:form.elements.audience.value,readerPromise:form.elements.readerPromise.value,channels,marketplace:$('#market-marketplace').value,launchDate:form.elements.launchDate.value?new Date(form.elements.launchDate.value).toISOString():undefined,marketResearchReportId:latest?.id})});state.activeCampaignId=result.campaign.id;message(`Real AI campaign draft created with ${result.campaign.assets.length} asset(s). Review every asset.`,true);await loadCampaigns();}catch(e){message(e.message);}finally{if(button)button.disabled=false;}}
  async function loadCampaigns(){if(!state.bookId)return;try{const data=await api(rootUrl(`/promotion/campaigns?bookId=${encodeURIComponent(state.bookId)}`));state.campaigns=data.campaigns||[];if(!state.activeCampaignId)state.activeCampaignId=state.campaigns[0]?.campaign?.id||'';renderCampaigns();}catch(e){message(e.message);}}
  function renderCampaigns(){const target=$('#promotion-campaigns');if(!target)return;if(!state.campaigns.length){target.innerHTML='<p class="muted">No durable promotion campaigns yet.</p>';return;}target.innerHTML=state.campaigns.map((entry)=>{const c=entry.campaign;return `<article class="memory promotion-campaign" data-campaign="${esc(c.id)}"><strong>${esc(c.objective)}</strong><p>${esc(c.audience)} • ${esc(c.readerPromise)}</p>${(c.assets||[]).map((a)=>`<div class="memory" data-asset="${esc(a.id)}"><strong>${esc(a.channel)} • ${esc(a.status)} • ${esc(a.title)}</strong><p>${esc(a.body)}</p>${(a.evidence||[]).map((e)=>`<small>${esc(e.confidence)} • ${esc(e.claim)}</small>`).join('')}<div class="row"><button type="button" data-promo-action="approve">Approve</button><button type="button" data-promo-action="reject">Reject</button><input data-promo-schedule type="datetime-local"><button type="button" data-promo-action="schedule">Schedule</button><button type="button" data-promo-action="publish">Mark published</button></div></div>`).join('')}</article>`;}).join('');$$('[data-promo-action]',target).forEach((button)=>button.addEventListener('click',promotionAction));}
  async function promotionAction(event){const button=event.currentTarget,asset=button.closest('[data-asset]'),campaign=button.closest('[data-campaign]');const action=button.dataset.promoAction,assetId=asset.dataset.asset,campaignId=campaign.dataset.campaign;state.activeCampaignId=campaignId;const payload={bookId:state.bookId};if(action==='schedule'){const value=asset.querySelector('[data-promo-schedule]').value;if(!value)return message('Choose a schedule date/time first.');payload.when=new Date(value).toISOString();}if(action==='publish'){if(!window.confirm('Confirm that this asset was actually published externally and mark the durable campaign record as published?'))return;payload.authorApproved=true;payload.externalReference=window.prompt('Optional external post/ad/reference id or URL:', '')||undefined;}try{await api(rootUrl(`/promotion/campaigns/${encodeURIComponent(campaignId)}/assets/${encodeURIComponent(assetId)}/${action}`),{method:'POST',body:JSON.stringify(payload)});await loadCampaigns();message(`Promotion asset ${action} recorded.`,true);}catch(e){message(e.message);}}
  async function promotionReadiness(){const campaignId=state.activeCampaignId||state.campaigns[0]?.campaign?.id;if(!campaignId)return message('Create or load a promotion campaign first.');try{const report=await api(rootUrl(`/promotion/readiness?bookId=${encodeURIComponent(state.bookId)}&campaignId=${encodeURIComponent(campaignId)}`));renderPromotionReadiness(report);message('Promotion readiness checked.',true);}catch(e){message(e.message);}}
  function renderPromotionReadiness(report){const target=$('#promotion-readiness-result');if(!target)return;target.innerHTML=`<article class="memory"><strong>${report.status==='ready'?'Promotion is release-ready':'Promotion needs attention'}</strong><p>${report.errorCount} blocker(s) • ${report.warningCount} warning(s)</p></article>`+(report.checks||[]).filter((c)=>c.status==='attention').map((c)=>`<article class="memory"><strong>${esc(c.severity)} • ${esc(c.label)}</strong><p>${esc(c.remediation||c.message)}</p></article>`).join('');}
  async function releaseGate(){const campaignId=state.activeCampaignId||state.campaigns[0]?.campaign?.id;if(!campaignId)return message('A promotion campaign is required for the combined release gate.');try{const report=await api(rootUrl(`/release-gate?bookId=${encodeURIComponent(state.bookId)}&campaignId=${encodeURIComponent(campaignId)}`));const target=$('#release-gate-result');target.innerHTML=`<article class="memory"><strong>${report.status==='ready'?'READY TO RELEASE':'RELEASE BLOCKED'}</strong><p>${report.blockers.length} blocker(s)</p></article>`+(report.blockers||[]).map((b)=>`<article class="memory"><strong>${esc(b.kind)}</strong><p>${esc(b.message)}</p><small>${esc(b.remediation)}</small></article>`).join('');message(report.status==='ready'?'Combined Publishing + Promotion release gate is ready.':'Release blockers remain.',report.status==='ready');}catch(e){message(e.message);}}

  function bind(){
    if ($('#forge-publishing-office')?.dataset.bound) return;
    $('#forge-publishing-office').dataset.bound='true';
    $('#publishing-metadata-form')?.addEventListener('submit',savePublishingMetadata);
    $('#publishing-readiness-form')?.addEventListener('submit',runPublishingReadiness);
    $('#publishing-book')?.addEventListener('change',(e)=>selectBook(e.target.value));
    $('#market-book')?.addEventListener('change',(e)=>selectBook(e.target.value));
    $('#run-market-research')?.addEventListener('click',runMarketResearch);
    $('#refresh-market-research')?.addEventListener('click',loadMarketResearch);
    $('#promotion-generate-form')?.addEventListener('submit',generatePromotion);
    $('#refresh-campaigns')?.addEventListener('click',loadCampaigns);
    $('#promotion-readiness')?.addEventListener('click',promotionReadiness);
    $('#run-release-gate')?.addEventListener('click',releaseGate);
  }

  window.addEventListener('forge:workspace-ready',()=>syncBooks());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePanels,{once:true});else ensurePanels();
  window.forgePublishingPromotion={refresh:()=>selectBook(state.bookId||activeBook()?.id||''),state};
})();