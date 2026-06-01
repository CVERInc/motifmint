<script lang="ts">
  import { t } from '~/lib/i18n-store';
  import { hasImage } from '~/lib/view-store';
</script>

<!-- Intro copy only matters before a file is loaded; afterwards it just takes
     up space, so it yields to the studio. -->
{#if !$hasImage}
  <header class="hero">
    <h1>{$t('hero.title')}</h1>
    <p class="tagline">{$t('hero.tagline')}</p>
  </header>
{/if}

<style>
  .hero {
    text-align: center;
    margin-bottom: 1.75rem;
  }
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .tagline {
    color: var(--muted);
    font-size: 1.0625rem;
    margin: 0 auto;
    max-width: 46rem;
  }
</style>
