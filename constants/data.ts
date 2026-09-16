const daysFromNow = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

export interface FestivalInfo {
  name: string;
  edition: string;
  city: string;
  startDate: string;
  endDate: string;
  venue: string;
}

export interface Screening {
  id: string;
  filmId: string;
  date: string;
  time: string;
  venue: string;
  screen: string;
  status: 'Available' | 'Nearly full' | 'Sold out';
}

export interface Film {
  id: string;
  title: string;
  country: string;
  year: number;
  runtimeMinutes: number;
  director: string;
  synopsis: string;
  genres: string[];
  imageUrl: string;
  alt: string;
  premiere: string;
  screeningIds: string[];
  reviewStatus: 'Not started' | 'In progress' | 'Approved';
  saved: boolean;
}

export interface Review {
  id: string;
  filmId: string;
  reviewer: string;
  status: 'Needs review' | 'In progress' | 'Approved';
  confidence: number;
  overallScore: number;
  originalityScore: number;
  craftScore: number;
  emotionalScore: number;
  aiHighlights: string[];
  humanNotes: string;
  updatedAt: string;
}

export interface AwardNominee {
  id: string;
  filmId: string;
  category: string;
  juryScore: number;
  voteCount: number;
  place: number;
  winner: boolean;
}

export interface AwardCategory {
  id: string;
  name: string;
  shortName: string;
  description: string;
  nomineeIds: string[];
}

export const festivalInfo: FestivalInfo = {
  name: 'Northstar Film Festival',
  edition: '18th Edition',
  city: 'Portland, Oregon',
  startDate: daysFromNow(0),
  endDate: daysFromNow(5),
  venue: 'Northstar Arts District',
};

export const films: Film[] = [
  {
    id: 'film-orbiting-home',
    title: 'Orbiting Home',
    country: 'United States',
    year: 2025,
    runtimeMinutes: 108,
    director: 'Mara Ellis',
    synopsis: 'After a decade away, a satellite engineer returns to the high desert town she left behind and finds a family story still waiting to be heard.',
    genres: ['Drama', 'Family'],
    imageUrl: 'https://images.unsplash.com/photo-1616530940355-351fabd9524b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'A cinematic movie cover representing Orbiting Home',
    premiere: 'North American Premiere',
    screeningIds: ['screening-orbiting-1', 'screening-orbiting-2'],
    reviewStatus: 'In progress',
    saved: true,
  },
  {
    id: 'film-after-the-rain',
    title: 'After the Rain',
    country: 'Japan',
    year: 2025,
    runtimeMinutes: 94,
    director: 'Ren Ito',
    synopsis: 'Two neighbors map the quiet changes in their coastal village one rainy season, one memory at a time.',
    genres: ['Documentary', 'Human Stories'],
    imageUrl: 'https://images.unsplash.com/photo-1619164816991-22d393238d8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHwyfHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'A cinematic movie poster collection representing After the Rain',
    premiere: 'Festival Selection',
    screeningIds: ['screening-rain-1'],
    reviewStatus: 'Not started',
    saved: false,
  },
  {
    id: 'film-blue-hour',
    title: 'Blue Hour',
    country: 'France',
    year: 2024,
    runtimeMinutes: 121,
    director: 'Camille Moreau',
    synopsis: 'A night-shift radio host takes one final call before dawn and is pulled into an unexpected journey across Paris.',
    genres: ['Drama', 'Nightlife'],
    imageUrl: 'https://images.unsplash.com/photo-1695834320369-015c8b9204f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHwzfHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'A theater poster display representing Blue Hour',
    premiere: 'International Competition',
    screeningIds: ['screening-blue-1', 'screening-blue-2'],
    reviewStatus: 'Approved',
    saved: true,
  },
  {
    id: 'film-small-currents',
    title: 'Small Currents',
    country: 'Kenya',
    year: 2025,
    runtimeMinutes: 87,
    director: 'Amina Wekesa',
    synopsis: 'A young hydrologist follows disappearing waterways and discovers the people keeping a fragile ecosystem alive.',
    genres: ['Documentary', 'Environment'],
    imageUrl: 'https://images.unsplash.com/photo-1628617468906-31e9633ad94f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHw0fHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'A bold street poster representing Small Currents',
    premiere: 'World Premiere',
    screeningIds: ['screening-currents-1'],
    reviewStatus: 'Not started',
    saved: false,
  },
  {
    id: 'film-echoes-in-green',
    title: 'Echoes in Green',
    country: 'Ireland',
    year: 2024,
    runtimeMinutes: 102,
    director: 'Niamh Doyle',
    synopsis: 'A singer returns to her island home to record the songs her grandmother never finished.',
    genres: ['Music', 'Drama'],
    imageUrl: 'https://images.unsplash.com/photo-1771775734936-a7cd2d3174e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHw1fHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'A festival lineup sign representing Echoes in Green',
    premiere: 'Festival Selection',
    screeningIds: ['screening-echoes-1'],
    reviewStatus: 'In progress',
    saved: false,
  },
  {
    id: 'film-static-light',
    title: 'Static Light',
    country: 'South Korea',
    year: 2025,
    runtimeMinutes: 76,
    director: 'Han Seo-jun',
    synopsis: 'An experimental portrait of a city after midnight, assembled from fragments of surveillance, memory, and sound.',
    genres: ['Experimental', 'Art'],
    imageUrl: 'https://images.unsplash.com/photo-1780764818559-1dd2205ea2c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHw2fHxjaW5lbWF0aWMlMjBpbmRlcGVuZGVudCUyMGZpbG0lMjBmZXN0aXZhbCUyMHN0aWxscyUyMGFuZCUyMGZpbG0lMjBwb3N0ZXJzfGVufDF8MXx8fDE3ODY3MDA4Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Movie posters under green light representing Static Light',
    premiere: 'Midnight Program',
    screeningIds: ['screening-static-1'],
    reviewStatus: 'Not started',
    saved: false,
  },
];

export const screenings: Screening[] = [
  { id: 'screening-orbiting-1', filmId: 'film-orbiting-home', date: daysFromNow(0), time: '18:30', venue: 'Orpheum Theater', screen: 'Screen 1', status: 'Nearly full' },
  { id: 'screening-orbiting-2', filmId: 'film-orbiting-home', date: daysFromNow(2), time: '12:15', venue: 'Lumen Hall', screen: 'Screen 2', status: 'Available' },
  { id: 'screening-rain-1', filmId: 'film-after-the-rain', date: daysFromNow(1), time: '15:00', venue: 'Lumen Hall', screen: 'Screen 2', status: 'Available' },
  { id: 'screening-blue-1', filmId: 'film-blue-hour', date: daysFromNow(0), time: '21:15', venue: 'Orpheum Theater', screen: 'Screen 1', status: 'Sold out' },
  { id: 'screening-blue-2', filmId: 'film-blue-hour', date: daysFromNow(3), time: '17:45', venue: 'Civic Cinema', screen: 'Screen 4', status: 'Available' },
  { id: 'screening-currents-1', filmId: 'film-small-currents', date: daysFromNow(2), time: '10:00', venue: 'Civic Cinema', screen: 'Screen 3', status: 'Available' },
  { id: 'screening-echoes-1', filmId: 'film-echoes-in-green', date: daysFromNow(4), time: '19:00', venue: 'Orpheum Theater', screen: 'Screen 2', status: 'Nearly full' },
  { id: 'screening-static-1', filmId: 'film-static-light', date: daysFromNow(1), time: '23:00', venue: 'Civic Cinema', screen: 'Screen 4', status: 'Available' },
];

export const reviews: Review[] = [
  { id: 'review-orbiting-home', filmId: 'film-orbiting-home', reviewer: 'Priya Nair', status: 'Needs review', confidence: 88, overallScore: 82, originalityScore: 86, craftScore: 80, emotionalScore: 84, aiHighlights: ['A confident lead performance carries the second act.', 'The desert sound design creates a memorable sense of place.'], humanNotes: '', updatedAt: daysFromNow(-1) },
  { id: 'review-blue-hour', filmId: 'film-blue-hour', reviewer: 'Jon Bell', status: 'Approved', confidence: 96, overallScore: 91, originalityScore: 90, craftScore: 94, emotionalScore: 89, aiHighlights: ['Elegant pacing builds a strong final movement.', 'Night photography is consistently expressive.'], humanNotes: 'Ready for the international jury packet.', updatedAt: daysFromNow(-2) },
  { id: 'review-echoes-green', filmId: 'film-echoes-in-green', reviewer: 'Mina Park', status: 'In progress', confidence: 74, overallScore: 78, originalityScore: 81, craftScore: 75, emotionalScore: 79, aiHighlights: ['The archival recordings add emotional weight.', 'Consider clarifying the timeline in the middle section.'], humanNotes: 'Checking the final sound mix before approval.', updatedAt: daysFromNow(0) },
  { id: 'review-small-currents', filmId: 'film-small-currents', reviewer: 'Alex Romero', status: 'Needs review', confidence: 81, overallScore: 85, originalityScore: 84, craftScore: 83, emotionalScore: 88, aiHighlights: ['Strong relationship between personal and environmental stakes.'], humanNotes: '', updatedAt: daysFromNow(-3) },
];

export const awardNominees: AwardNominee[] = [
  { id: 'nominee-orbiting-best-film', filmId: 'film-orbiting-home', category: 'best-film', juryScore: 92, voteCount: 184, place: 1, winner: false },
  { id: 'nominee-blue-best-film', filmId: 'film-blue-hour', category: 'best-film', juryScore: 91, voteCount: 177, place: 2, winner: false },
  { id: 'nominee-currents-best-film', filmId: 'film-small-currents', category: 'best-film', juryScore: 88, voteCount: 143, place: 3, winner: false },
  { id: 'nominee-echoes-audience', filmId: 'film-echoes-in-green', category: 'audience-choice', juryScore: 89, voteCount: 231, place: 1, winner: true },
  { id: 'nominee-rain-audience', filmId: 'film-after-the-rain', category: 'audience-choice', juryScore: 86, voteCount: 208, place: 2, winner: false },
  { id: 'nominee-static-director', filmId: 'film-static-light', category: 'best-director', juryScore: 90, voteCount: 119, place: 1, winner: false },
  { id: 'nominee-orbiting-director', filmId: 'film-orbiting-home', category: 'best-director', juryScore: 87, voteCount: 113, place: 2, winner: false },
];

export const awardCategories: AwardCategory[] = [
  { id: 'best-film', name: 'Best Film', shortName: 'Best Film', description: 'The festival jury\'s highest honor.', nomineeIds: ['nominee-orbiting-best-film', 'nominee-blue-best-film', 'nominee-currents-best-film'] },
  { id: 'audience-choice', name: 'Audience Choice', shortName: 'Audience', description: 'Selected by votes from festival audiences.', nomineeIds: ['nominee-echoes-audience', 'nominee-rain-audience'] },
  { id: 'best-director', name: 'Best Director', shortName: 'Director', description: 'For an exceptional directorial vision.', nomineeIds: ['nominee-static-director', 'nominee-orbiting-director'] },
];

export const FILMS = films;
export const SCREENINGS = screenings;
export const REVIEWS = reviews;
export const AWARD_NOMINEES = awardNominees;
export const AWARD_CATEGORIES = awardCategories;
