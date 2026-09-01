/* Durable post-launch Promotion performance. Forge records observed platform data and derives only supported metrics. */
(() => {
  'use strict';
  const projectId = new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || 'forge-studio';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const rootUrl = (suffix = '') => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const numberOrUndefined = (value) => String(value ?? '').trim() === '' ? undefined : Number(value);

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'content-type':'application/json', ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }
  function message(text, ok = false) {
    const target = ok ? $('#success-banner') : $('#error-banner'); if (!target) return;
    target.textContent = text; target.hidden = false;
    const other = ok ? $('#error-banner') : $('#success-banner'); if (other) other.hidden = true;
    if (ok) setTimeout(() => { target.hidden = true; }, 4000);
  }
  function context() {
    const state = window.forgePublishingPromotion?.state;
    return { bookId: state?.bookId || '', campaignId: state?.activeCampaignId || state?.campaigns?.[0]?.campaign?.id || '', campaigns: state?.campaigns || [] };
  }
  function currentCampaign() { const ctx=context(); return ctx.campaigns.find((entry)=>entry.campaign?.id===ctx.campaignId)?.campaign || ctx.campaigns[0]?.campaign; }
  function localDateTime(iso) { const date = iso ? new Date(iso) : new Date(); if (Number.isNaN(date.getTime())) return ''; const shifted = new Date(date.getTime() - date.getTimezoneOffset()*60000); return shifted.toISOString().slice(0,16); }

  function ensurePanel() {
    const office = $('#forge-promotion-office');
    if (!office || $('#promotion-performance-card')) return;
    const grid = office.querySelector('.grid'); if (!grid) return;
    const card = document.createElement('article'); card.id='promotion-performance-card'; card.className='card';
    card.innerHTML = `
      <div class="eyebrow">POST-LAUNCH PERFORMANCE</div><h3>Observed campaign results</h3>
      <p class="muted">Record actual platform/export results. Forge derives CTR, CPC, CPM, attributed conversion, CPA, ACOS, ROAS, and email open rate only when the required observed fields exist. It never substitutes unrelated retailer sales for attributed campaign results.</p>
      <form id="promotion-performance-form">
        <div class="row"><label>Source<select name="source"><option value="amazon-ads">Amazon Ads</option><option value="email">Email</option><option value="social">Social</option><option value="author-site">Author site</option><option value="retailer">Retailer</option><option value="press">Press</option><option value="reader-community">Reader community</option><option value="bookbub-ads">BookBub Ads</option><option value="other">Other</option></select></label><label>Campaign asset<select name="assetId"><option value="">Whole campaign</option></select></label></div>
        <div class="row"><label>Period start<input name="periodStart" type="datetime-local" required></label><label>Period end<input name="periodEnd" type="datetime-local" required></label></div>
        <div class="row"><label>Impressions<input name="impressions" type="number" min="0"></label><label>Clicks<input name="clicks" type="number" min="0"></label><label>Spend<input name="spend" type="number" min="0" step="0.01"></label><label>Currency<input name="currency" value="USD" maxlength="3"></label></div>
        <div class="row"><label>Attributed orders<input name="attributedOrders" type="number" min="0"></label><label>Attributed units<input name="attributedUnits" type="number" min="0"></label><label>Attributed revenue<input name="attributedRevenue" type="number" min="0" step="0.01"></label></div>
        <div class="row"><label>Email delivered<input name="delivered" type="number" min="0"></label><label>Email opens<input name="opens" type="number" min="0"></label></div>
        <label>Source reference<input name="sourceReference" required placeholder="Amazon Ads report 2026-09-01, ESP export, analytics report…"></label>
        <label>Source URL (optional)<input name="sourceUrl" type="url" placeholder="https://…"></label>
        <label>Notes<textarea name="notes" rows="3" placeholder="Experiment setup, targeting, creative change, or attribution caveat."></textarea></label>
        <div class="row"><button class="primary" type="submit">Record observed performance</button><button id="refresh-promotion-performance" type="button">Refresh performance</button></div>
      </form>
      <div id="promotion-performance-results" class="list"></div>`;
    grid.appendChild(card);
    const now = new Date(), start = new Date(now.getTime() - 24*60*60*1000);
    card.querySelector('[name="periodStart"]').value = localDateTime(start.toISOString());
    card.querySelector('[name="periodEnd"]').value = localDateTime(now.toISOString());
    $('#promotion-performance-form')?.addEventListener('submit', recordPerformance);
    $('#refresh-promotion-performance')?.addEventListener('click', loadPerformance);
    syncAssets();
  }

  function syncAssets() {
    const select = $('#promotion-performance-form [name="assetId"]'); if (!select) return;
    const campaign = currentCampaign(); const previous = select.value;
    const options = (campaign?.assets || []).map((asset)=>`<option value="${esc(asset.id)}">${esc(asset.channel)} • ${esc(asset.title)}</option>`).join('');
    select.innerHTML = `<option value="">Whole campaign</option>${options}`;
    if (previous && (campaign?.assets||[]).some((asset)=>asset.id===previous)) select.value=previous;
  }

  async function recordPerformance(event) {
    event.preventDefault(); const form=event.currentTarget, ctx=context();
    if (!ctx.bookId || !ctx.campaignId) return message('Load a Promotion campaign before recording performance.');
    const metrics = Object.fromEntries(['impressions','clicks','spend','attributedOrders','attributedUnits','attributedRevenue','delivered','opens'].map((name)=>[name,numberOrUndefined(form.elements[name].value)]).filter(([,value])=>value!==undefined));
    if (!Object.keys(metrics).length) return message('Enter at least one observed performance metric.');
    try {
      await api(rootUrl('/promotion/performance'),{method:'POST',body:JSON.stringify({bookId:ctx.bookId,campaignId:ctx.campaignId,assetId:form.elements.assetId.value||undefined,source:form.elements.source.value,periodStart:new Date(form.elements.periodStart.value).toISOString(),periodEnd:new Date(form.elements.periodEnd.value).toISOString(),observedAt:new Date().toISOString(),currency:form.elements.currency.value||undefined,sourceReference:form.elements.sourceReference.value,sourceUrl:form.elements.sourceUrl.value||undefined,notes:form.elements.notes.value||undefined,metrics})});
      message('Observed Promotion performance saved durably.',true); await loadPerformance();
    } catch(error){message(error.message);}
  }

  function format(value, suffix=''){return value===undefined?'—':`${Number(value).toLocaleString(undefined,{maximumFractionDigits:4})}${suffix}`;}
  async function loadPerformance() {
    const ctx=context(); if (!ctx.bookId || !ctx.campaignId) return;
    syncAssets();
    try {
      const summary=await api(rootUrl(`/promotion/performance?bookId=${encodeURIComponent(ctx.bookId)}&campaignId=${encodeURIComponent(ctx.campaignId)}`));
      const target=$('#promotion-performance-results'); if(!target)return;
      target.innerHTML=(summary.snapshots||[]).map(({snapshot,derived})=>`<article class="memory"><strong>${esc(snapshot.source)}${snapshot.assetId?` • ${esc(snapshot.assetId)}`:''}</strong><p>${esc(snapshot.periodStart)} → ${esc(snapshot.periodEnd)}</p><div class="metrics">${[['CTR',format(derived.ctrPercent,'%')],['CPC',format(derived.costPerClick)],['CPM',format(derived.costPerThousandImpressions)],['Conversion',format(derived.attributedConversionPercent,'%')],['CPA',format(derived.costPerAttributedOrder)],['ACOS',format(derived.acosPercent,'%')],['ROAS',format(derived.roas)],['Open rate',format(derived.emailOpenRatePercent,'%')]].map(([label,value])=>`<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div><small>${esc(snapshot.sourceReference)}</small></article>`).join('')||'<p class="muted">No observed performance recorded for this campaign.</p>';
      if(summary.insights?.length)target.innerHTML+=`<h4>Evidence-aware insights</h4>${summary.insights.map((item)=>`<article class="memory"><strong>${esc(item.kind)}</strong><p>${esc(item.message)}</p></article>`).join('')}`;
    } catch(error){message(error.message);}
  }

  function ready() { ensurePanel(); syncAssets(); }
  window.addEventListener('forge:workspace-ready',ready);
  document.addEventListener('click',(event)=>{if(event.target?.closest?.('#refresh-campaigns,[data-promo-action]'))setTimeout(()=>{syncAssets();void loadPerformance();},250);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.forgePromotionPerformance={refresh:loadPerformance};
})();
