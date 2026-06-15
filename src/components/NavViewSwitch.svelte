<script lang="ts">
  import { previewView, hasImage } from '~/lib/view-store';
</script>

{#if $hasImage}
  <div class="nav-switch" role="tablist" aria-label="Preview mode">
    <button
      type="button"
      role="tab"
      aria-selected={$previewView === 'svg'}
      class:on={$previewView === 'svg'}
      onclick={() => previewView.set('svg')}
    >SVG</button>
    <button
      type="button"
      role="tab"
      aria-selected={$previewView === 'ascii'}
      class:on={$previewView === 'ascii'}
      onclick={() => previewView.set('ascii')}
    >ASCII</button>
  </div>
{/if}

<style>
  .nav-switch {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    border-radius: 10px;
    corner-shape: var(--corner);
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.05);
  }
  .nav-switch button {
    padding: 0.45rem 1.4rem;
    border: none;
    border-radius: 8px;
    corner-shape: var(--corner);
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .nav-switch button:hover {
    color: var(--text);
  }
  .nav-switch button.on {
    background: var(--accent);
    color: var(--accent-fg);
  }
</style>
