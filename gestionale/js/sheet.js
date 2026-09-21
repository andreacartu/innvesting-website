// Foglio a comparsa con un modulo generato da una lista di campi.
// openForm() restituisce una Promise: il risultato di onSubmit (o `true`), `{ deleted: true }` o `null` se annullato.

import { html, raw } from './dom.js';
import { icon } from './icons.js';
import { moneyToInput, parseMoney } from './format.js';
import { hydratePhotos } from './photos.js';

const optionsOf = field => (typeof field.options === 'function' ? field.options() : field.options ?? []);

function optionList(field, current) {
  return html`
    ${!field.noEmpty && !(field.required && current) && html`<option value="">${field.placeholder ?? 'Seleziona…'}</option>`}
    ${optionsOf(field).map(o => html`<option value="${o.value}" ${String(o.value) === String(current ?? '') && raw('selected')}>${o.label}</option>`)}
    ${field.allowNew && html`<option value="__new__">+ ${field.allowNew.label}</option>`}
  `;
}

function control(field, value) {
  const name = field.name;
  const required = field.required && raw('required');
  const placeholder = field.placeholder ?? '';

  switch (field.type) {
    case 'textarea':
      return html`<textarea class="field__input" id="f-${name}" name="${name}" rows="3" placeholder="${placeholder}">${value ?? ''}</textarea>`;
    case 'select':
      return html`<select class="field__input" id="f-${name}" name="${name}" ${required} ${field.allowNew && raw('data-allow-new')}>${optionList(field, value)}</select>`;
    case 'photos':
      return html`<div class="photo-field" data-photo-field="${name}"><div class="photo-field__grid"></div><label class="btn btn--outline btn--sm photo-field__add">${icon('plus', 16)}${field.max === 1 ? 'Scegli la foto' : 'Aggiungi foto'}<input type="file" id="f-${name}" accept="image/*" ${field.max !== 1 && raw('multiple')} hidden></label></div>`;
    case 'money':
    case 'percent':
      return html`<div class="field__money"><input class="field__input" type="text" inputmode="decimal" pattern="[0-9.,\\s€%]*" id="f-${name}" name="${name}" value="${moneyToInput(value)}" placeholder="${placeholder || '0'}" autocomplete="off" ${required}><span class="field__unit">${field.type === 'percent' ? '%' : '€'}</span></div>`;
    default:
      return html`<input class="field__input" type="${field.type ?? 'text'}" id="f-${name}" name="${name}" value="${value ?? ''}" placeholder="${placeholder}"
        ${field.suggestions && raw(`list="list-${name}"`)} ${field.type === 'tel' && raw('inputmode="tel"')} autocomplete="off" ${required}>
        ${field.suggestions && html`<datalist id="list-${name}">${field.suggestions.map(s => html`<option value="${s}"></option>`)}</datalist>`}`;
  }
}

function fieldHtml(field, value) {
  if (field.type === 'checkbox') {
    return html`<label class="field field--check"><input type="checkbox" name="${field.name}" ${value && raw('checked')}><span>${field.label}</span></label>
      ${field.hint && html`<p class="field__hint">${field.hint}</p>`}`;
  }
  if (field.type === 'note') return html`<p class="field__hint sheet__note">${field.text}</p>`;
  return html`
    <div class="field ${field.half && 'field--half'}">
      <label class="field__label" for="f-${field.name}">${field.label}</label>
      ${control(field, value)}
      ${field.hint && html`<p class="field__hint">${field.hint}</p>`}
    </div>
    ${field.quick && html`<div class="field__quick" data-quick-for="${field.quickTarget ?? field.name}">${field.quick.map(q => html`<button type="button" class="chip" data-quick="${q.value}">${q.label}</button>`)}</div>`}`;
}

function readValues(form, fields, photoStates) {
  const result = {};
  for (const field of fields) {
    if (field.transient || field.type === 'note') continue;
    if (field.type === 'photos') { result[field.name] = photoStates.get(field.name); continue; }
    const el = form.elements[field.name];
    if (field.type === 'checkbox') result[field.name] = el.checked;
    else if (field.type === 'money' || field.type === 'percent') result[field.name] = parseMoney(el.value);
    else if (field.cast === 'number') result[field.name] = el.value === '' ? null : Number(el.value);
    else result[field.name] = el.value.trim();
  }
  return result;
}

export function openForm({ title, fields, values = {}, submitLabel = 'Salva', onSubmit, onDelete, deleteLabel = 'Elimina', deleteMessage = 'Eliminare definitivamente?' }) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'sheet';
    root.innerHTML = html`
      <div class="sheet__backdrop" data-close></div>
      <form class="sheet__panel" role="dialog" aria-modal="true" aria-label="${title}" novalidate>
        <header class="sheet__header">
          <h2 class="sheet__title">${title}</h2>
          <button type="button" class="icon-btn icon-btn--end" data-close aria-label="Chiudi">${icon('x')}</button>
        </header>
        <div class="sheet__body">${fields.map(f => fieldHtml(f, values[f.name]))}</div>
        <footer class="sheet__footer">
          ${onDelete && html`<button type="button" class="btn btn--outline btn--danger" data-delete>${deleteLabel}</button>`}
          <button type="submit" class="btn btn--primary">${submitLabel}</button>
        </footer>
      </form>`.value;
    document.body.append(root);
    document.documentElement.classList.add('is-locked');

    const form = root.querySelector('form');
    let closed = false;

    const close = result => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      root.classList.add('is-closing');
      const finish = () => {
        root.remove();
        if (!document.querySelector('.sheet')) document.documentElement.classList.remove('is-locked');
        resolve(result);
      };
      root.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 260);
    };

    const onKey = event => {
      const topmost = [...document.querySelectorAll('.sheet')].pop();
      if (event.key === 'Escape' && topmost === root) close(null);
    };
    document.addEventListener('keydown', onKey);

    root.addEventListener('click', event => {
      if (event.target.closest('[data-close]')) close(null);
    });

    // Foto: per ogni campo tengo gli identificativi già salvati e i nuovi file scelti (non ancora salvati).
    const photoStates = new Map();
    fields.filter(f => f.type === 'photos').forEach(field => {
      const initial = values[field.name];
      const state = { ids: [initial].flat().filter(Boolean), files: [] };
      photoStates.set(field.name, state);
      const grid = form.querySelector(`[data-photo-field="${field.name}"] .photo-field__grid`);
      const previews = new Map();

      const draw = () => {
        grid.innerHTML = [
          ...state.ids.map(id => html`<div class="photo-thumb" data-photo-frame><img data-photo="${id}" alt=""><button type="button" class="photo-thumb__remove" data-remove-id="${id}" aria-label="Rimuovi la foto">${icon('x', 16)}</button></div>`),
          ...state.files.map((file, i) => html`<div class="photo-thumb"><img data-preview="${i}" alt=""><button type="button" class="photo-thumb__remove" data-remove-file="${i}" aria-label="Rimuovi la foto">${icon('x', 16)}</button></div>`),
        ].map(fragment => fragment.value).join('');
        grid.querySelectorAll('img[data-preview]').forEach(img => {
          const file = state.files[Number(img.dataset.preview)];
          if (!previews.has(file)) previews.set(file, URL.createObjectURL(file));
          img.src = previews.get(file);
        });
        hydratePhotos(grid);
      };

      grid.addEventListener('click', event => {
        const removeId = event.target.closest('[data-remove-id]')?.dataset.removeId;
        const removeFile = event.target.closest('[data-remove-file]')?.dataset.removeFile;
        if (removeId) state.ids = state.ids.filter(id => id !== removeId);
        else if (removeFile !== undefined) state.files.splice(Number(removeFile), 1);
        else return;
        draw();
      });

      form.querySelector(`#f-${field.name}`).addEventListener('change', event => {
        const chosen = [...event.target.files];
        event.target.value = '';
        if (field.max === 1) { state.ids = []; state.files = chosen.slice(0, 1); } // una sola foto: la nuova sostituisce la vecchia
        else state.files.push(...chosen);
        draw();
      });

      draw();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      submit.textContent = 'Salvataggio…';
      try {
        close((await onSubmit(readValues(form, fields, photoStates))) ?? true);
      } catch (error) {
        submit.disabled = false;
        submit.textContent = submitLabel;
        alert(error?.message || 'Non è stato possibile salvare.');
      }
    });

    root.querySelector('[data-delete]')?.addEventListener('click', () => {
      if (!confirm(deleteMessage)) return;
      onDelete();
      close({ deleted: true });
    });

    form.querySelectorAll('[data-quick]').forEach(button => {
      button.addEventListener('click', () => {
        const input = form.elements[button.closest('[data-quick-for]').dataset.quickFor];
        input.value = moneyToInput(Number(button.dataset.quick));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });
    });

    // Campo percentuale legato a un importo: scrivendo l'uno si aggiorna l'altro.
    fields.filter(f => f.type === 'percent' && f.linkedTo && f.base > 0).forEach(field => {
      const percentInput = form.elements[field.name];
      const amountInput = form.elements[field.linkedTo];
      const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
      amountInput.addEventListener('input', () => {
        const amount = parseMoney(amountInput.value);
        percentInput.value = amount === null ? '' : moneyToInput(round((amount / field.base) * 100));
      });
      percentInput.addEventListener('input', () => {
        const pct = parseMoney(percentInput.value);
        amountInput.value = pct === null ? '' : moneyToInput(round((field.base * pct) / 100));
      });
    });

    // "+ Nuovo fornitore" dentro un menu: apre un secondo foglio e, al ritorno, seleziona la voce appena creata.
    form.querySelectorAll('select[data-allow-new]').forEach(select => {
      const field = fields.find(f => f.name === select.name);
      let previous = select.value;
      select.addEventListener('change', async () => {
        if (select.value !== '__new__') { previous = select.value; return; }
        select.value = previous;
        const created = await field.allowNew.create();
        if (created && created !== true) {
          select.innerHTML = optionList(field, created).value;
          previous = select.value;
        }
      });
    });

    if (matchMedia('(pointer: fine)').matches) form.querySelector('.field__input')?.focus();
  });
}
