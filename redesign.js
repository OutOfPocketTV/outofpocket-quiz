/* Presentation-only enhancements. Calculation, access and checkout remain in script.js. */
(function () {
  const byId = (id) => document.getElementById(id);
  const quiz = document.querySelector('.calculator-controls');
  const sexButtons = Array.from(document.querySelectorAll('#targetSexGroup .seg-btn'));
  function updateSummary() {
    const active = sexButtons.find((button) => button.classList.contains('active'));
    sexButtons.forEach((button) => button.setAttribute('aria-pressed', String(button === active)));
    byId('summarySex').textContent = active ? active.textContent : 'Men';
    byId('summaryAge').textContent = byId('ageMin').value + '–' + byId('ageMax').value;
    byId('summaryHeight').textContent = byId('heightBubble').textContent;
    byId('summaryIncome').textContent = byId('incomeBubble').textContent;
    const chosen = Array.from(quiz.querySelectorAll('.radio-list input:checked'))
      .filter((input) => input.value !== 'any').map((input) => input.closest('label').textContent.trim());
    const exclusions = ['excludeMarried', 'excludeKids', 'excludeGambles'].map(byId)
      .filter((input) => input.checked).map((input) => input.closest('label').textContent.trim());
    byId('summaryPreferences').textContent = chosen.concat(exclusions).join(', ') || 'Open to any';
    byId('ageMin').setAttribute('aria-valuetext', byId('ageMin').value + ' years');
    byId('ageMax').setAttribute('aria-valuetext', byId('ageMax').value + ' years');
    byId('heightSlider').setAttribute('aria-valuetext', byId('heightBubble').textContent);
    byId('incomeSlider').setAttribute('aria-valuetext', byId('incomeBubble').textContent + ' per year');
  }
  quiz.addEventListener('input', updateSummary);
  quiz.addEventListener('change', updateSummary);
  sexButtons.forEach((button) => button.addEventListener('click', updateSummary));
  document.addEventListener('quiz:result', updateSummary);

  // Purchase verification restores controls asynchronously; reflect that state too.
  function updateAccessState() {
    updateSummary();
    const unlocked = byId('premiumTeaser').classList.contains('unlocked');
    document.querySelectorAll('.paid-results-note, .hero-payment-note').forEach((element) => element.classList.toggle('hidden', unlocked));
    byId('report-details').classList.toggle('hidden', unlocked);
    document.querySelectorAll('a[href="#report-details"]').forEach((link) => {
      if (unlocked) link.setAttribute('href', '#globalReport');
    });
  }
  const accessObserver = new MutationObserver(updateAccessState);
  accessObserver.observe(byId('premiumTeaser'), { attributes: true, attributeFilter: ['class'] });
  byId('faqRestore').addEventListener('click', function () {
    if (byId('restoreAccessLink').classList.contains('hidden')) {
      byId('globalReport').scrollIntoView({ behavior: 'auto' });
      return;
    }
    if (byId('restoreAccessPanel').classList.contains('hidden')) byId('restoreAccessLink').click();
    byId('restoreAccessEmail').focus();
    byId('restoreAccessPanel').scrollIntoView({ block: 'center', behavior: 'auto' });
  });
  updateAccessState();
})();
