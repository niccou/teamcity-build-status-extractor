(function () {
  if (window.__teamCityExtractorListenerRegistered) {
    return;
  }
  window.__teamCityExtractorListenerRegistered = true;

  function getBuildIdFromUrl(url) {
    const match = url.match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : null;
  }

  async function fetchXml(url) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur réseau (${response.status}) sur ${url}`);
    }

    const xmlText = await response.text();
    return new DOMParser().parseFromString(xmlText, 'application/xml');
  }

  function attr(node, name, fallback) {
    if (!node) return fallback;
    const value = node.getAttribute(name);
    return value === null || value === '' ? fallback : value;
  }

  function formatBuildMessage(buildData, failedTests) {
    const lines = [];
    lines.push(`Build: ${buildData.buildTypeName} (#${buildData.id})`);
    lines.push(`Branche: ${buildData.branchName}`);
    lines.push(`Statut: ${buildData.status}`);
    lines.push(
      `Tests: ✅ ${buildData.testsPassed} | ❌ ${buildData.testsFailed} | ⏭ ${buildData.testsIgnored}`
    );

    if (failedTests.length > 0) {
      lines.push('');
      lines.push('Tests en échec:');
      for (const testName of failedTests) {
        lines.push(`- ${testName}`);
      }
    }

    return lines.join('\n');
  }

  async function buildMessageForCurrentPage() {
    const buildId = getBuildIdFromUrl(window.location.href);
    if (!buildId) {
      return { ok: false, error: "L'URL courante ne contient pas de buildId numérique." };
    }

    const baseUrl = window.location.origin;
    const buildUrl = `${baseUrl}/app/rest/builds/${buildId}?fields=id,status,branchName,buildType(name),testOccurrences(passed,failed,ignored)`;
    const failuresUrl = `${baseUrl}/app/rest/testOccurrences?locator=build:(id:${buildId}),status:FAILURE&fields=testOccurrence(name)&count=100`;

    try {
      const [buildXml, failuresXml] = await Promise.all([fetchXml(buildUrl), fetchXml(failuresUrl)]);

      const buildNode = buildXml.documentElement;
      const buildTypeNode = buildNode.querySelector('buildType');
      const testOccurrencesNode = buildNode.querySelector('testOccurrences');

      const buildData = {
        id: attr(buildNode, 'id', buildId),
        status: attr(buildNode, 'status', 'UNKNOWN'),
        branchName: attr(buildNode, 'branchName', 'N/A'),
        buildTypeName: attr(buildTypeNode, 'name', 'N/A'),
        testsPassed: attr(testOccurrencesNode, 'passed', '0'),
        testsFailed: attr(testOccurrencesNode, 'failed', '0'),
        testsIgnored: attr(testOccurrencesNode, 'ignored', '0')
      };

      const failedTests = Array.from(failuresXml.querySelectorAll('testOccurrence'))
        .map((node) => attr(node, 'name', '').trim())
        .filter(Boolean);

      return { ok: true, text: formatBuildMessage(buildData, failedTests) };
    } catch (error) {
      return {
        ok: false,
        error: error && error.message ? error.message : 'Erreur réseau lors de la récupération des données TeamCity.'
      };
    }
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.action !== 'extractTeamCityBuildStatus') {
      return;
    }

    buildMessageForCurrentPage().then(sendResponse);
    return true;
  });
})();
