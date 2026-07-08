// Responsible-gambling help resources, by app language. Shown in Settings and
// on the break screen. Numbers/URLs are the national problem-gambling lines.
export interface HelpResource {
  name: string
  phone?: string
  url: string
}

const HELP: Record<string, HelpResource[]> = {
  fr: [
    { name: 'Joueurs Info Service', phone: '09 74 75 13 13', url: 'https://www.joueurs-info-service.fr' },
    { name: 'ANJ — Évaluez votre jeu', url: 'https://evalujeu.fr' },
  ],
  en: [
    { name: 'GambleAware', phone: '0808 8020 133', url: 'https://www.begambleaware.org' },
    { name: 'Gambling Therapy', url: 'https://www.gamblingtherapy.org' },
  ],
  es: [
    { name: 'FEJAR', phone: '900 200 225', url: 'https://www.fejar.org' },
    { name: 'Jugar Bien', url: 'https://www.jugarbien.es' },
  ],
  de: [
    { name: 'BZgA — Spielsucht', phone: '0800 1 372 700', url: 'https://www.check-dein-spiel.de' },
    { name: 'Spielen mit Verantwortung', url: 'https://www.spielen-mit-verantwortung.de' },
  ],
  it: [
    { name: 'Telefono Verde (TVNGA)', phone: '800 558 822', url: 'https://www.iss.it/dipendenze' },
    { name: 'Gambling Therapy', url: 'https://www.gamblingtherapy.org' },
  ],
  pt: [
    { name: 'Linha Vida (SICAD)', phone: '1414', url: 'https://www.sicad.pt' },
    { name: 'Jogo Responsável (SRIJ)', url: 'https://www.jogoresponsavel.pt' },
  ],
}

export function helpResources(lang: string): HelpResource[] {
  return HELP[lang] ?? HELP.en
}
