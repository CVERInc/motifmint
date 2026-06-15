<script lang="ts">
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import { theme, toggleTheme } from '~/lib/theme-store';
  import { t } from '~/lib/i18n-store';

  // When dark, offer to go light (show a sun); when light, offer dark (moon).
  $: isDark = $theme === 'dark';
  $: label = isDark ? $t('theme.toLight') : $t('theme.toDark');
</script>

<button
  type="button"
  class="theme-toggle"
  onclick={toggleTheme}
  title={label}
  aria-label={label}
  aria-pressed={!isDark}
>
  {#if isDark}
    <Sun size={16} aria-hidden="true" />
  {:else}
    <Moon size={16} aria-hidden="true" />
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.1rem;
    height: 2.1rem;
    color: var(--text);
    background: rgba(127, 127, 127, 0.08);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      color 0.2s ease;
  }
  .theme-toggle:hover {
    border-color: var(--accent);
    background: rgba(127, 127, 127, 0.16);
    color: var(--accent);
  }
</style>
