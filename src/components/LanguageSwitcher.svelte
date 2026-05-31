<script lang="ts">
  import Languages from '@lucide/svelte/icons/languages';
  import { locale, t } from '~/lib/i18n-store';
  import { LOCALES, LOCALE_LABELS, isLocale } from '~/lib/i18n';
</script>

<label class="lang-switch" title={$t('switcher.label')}>
  <Languages size={15} aria-hidden="true" />
  <select
    aria-label={$t('switcher.label')}
    value={$locale}
    onchange={(e) => {
      const v = (e.currentTarget as HTMLSelectElement).value;
      if (isLocale(v)) locale.set(v);
    }}
  >
    {#each LOCALES as code (code)}
      <option value={code}>{LOCALE_LABELS[code]}</option>
    {/each}
  </select>
</label>

<style>
  .lang-switch {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text);
  }
  .lang-switch select {
    appearance: none;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.4rem 0.6rem;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .lang-switch select:hover {
    border-color: var(--accent);
    background: rgba(255, 255, 255, 0.1);
  }
  .lang-switch option {
    color: #000;
  }
</style>
