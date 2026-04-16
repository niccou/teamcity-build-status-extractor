(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  async function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!success) {
      throw new Error('Impossible de copier le texte dans le presse-papier.');
    }
  }

  async function getActiveTabId() {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) {
      throw new Error('Aucun onglet actif trouvé.');
    }
    return tabs[0].id;
  }

  async function extractBuildMessage() {
    const tabId = await getActiveTabId();
    await api.tabs.executeScript(tabId, { file: 'content.js' });
    return api.tabs.sendMessage(tabId, { action: 'extractTeamCityBuildStatus' });
  }

  async function handleCopyClick() {
    try {
      const result = await extractBuildMessage();
      if (!result || !result.ok) {
        alert((result && result.error) || 'Une erreur inconnue est survenue.');
        return;
      }

      await copyToClipboard(result.text);
      window.close();
    } catch (error) {
      alert(error && error.message ? error.message : 'Une erreur est survenue.');
    }
  }

  document.getElementById('copyButton').addEventListener('click', handleCopyClick);
})();
