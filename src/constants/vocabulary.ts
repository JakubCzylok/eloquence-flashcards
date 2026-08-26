export type VocabularyCategory =
  | 'business'
  | 'academic'
  | 'arts-culture'
  | 'science-tech'
  | 'current-events'
  | 'travel'
  | 'food-cuisine'
  | 'sports-fitness'
  | 'family-relationships';

export type VocabularyWord = {
  id: string;
  word: string;
  definition: string;
  category: VocabularyCategory;
};

export const SEED_VOCABULARY: VocabularyWord[] = [
  // business
  {
    id: 'acumen',
    word: 'acumen',
    definition: 'Keen insight and good judgment, especially in practical or financial matters.',
    category: 'business',
  },
  {
    id: 'leverage',
    word: 'leverage',
    definition: 'To use something you already have to gain the maximum possible advantage.',
    category: 'business',
  },
  {
    id: 'synergy',
    word: 'synergy',
    definition:
      'The combined effect of two things working together being greater than the sum of their separate effects.',
    category: 'business',
  },
  {
    id: 'pragmatic',
    word: 'pragmatic',
    definition: 'Dealing with problems in a sensible, realistic way rather than by rigid theory.',
    category: 'business',
  },
  {
    id: 'stakeholder',
    word: 'stakeholder',
    definition: 'A person or group with an interest or concern in a project or organization.',
    category: 'business',
  },
  {
    id: 'streamline',
    word: 'streamline',
    definition: 'To make a process simpler and more efficient by removing unnecessary steps.',
    category: 'business',
  },
  {
    id: 'scalable',
    word: 'scalable',
    definition: 'Able to grow or expand easily without losing effectiveness.',
    category: 'business',
  },
  {
    id: 'diligence',
    word: 'diligence',
    definition: 'Careful and persistent effort or work.',
    category: 'business',
  },

  // academic
  {
    id: 'discourse',
    word: 'discourse',
    definition: 'Written or spoken communication or debate about a particular topic.',
    category: 'academic',
  },
  {
    id: 'empirical',
    word: 'empirical',
    definition: 'Based on observation or direct experience rather than theory alone.',
    category: 'academic',
  },
  {
    id: 'nuance',
    word: 'nuance',
    definition: 'A subtle difference in meaning, tone, or expression.',
    category: 'academic',
  },
  {
    id: 'paradigm',
    word: 'paradigm',
    definition: 'A typical example or pattern that shapes how something is understood.',
    category: 'academic',
  },
  {
    id: 'rhetoric',
    word: 'rhetoric',
    definition: 'The art of speaking or writing persuasively.',
    category: 'academic',
  },
  {
    id: 'dialectic',
    word: 'dialectic',
    definition: 'A method of examining ideas through structured argument and counter-argument.',
    category: 'academic',
  },
  {
    id: 'erudite',
    word: 'erudite',
    definition: 'Having or showing deep knowledge gained through study.',
    category: 'academic',
  },
  {
    id: 'treatise',
    word: 'treatise',
    definition: 'A formal, thorough written work on a particular subject.',
    category: 'academic',
  },

  // arts-culture
  {
    id: 'aesthetic',
    word: 'aesthetic',
    definition: 'Concerned with beauty and the appreciation of what looks or sounds pleasing.',
    category: 'arts-culture',
  },
  {
    id: 'allegory',
    word: 'allegory',
    definition: 'A story whose characters and events carry a hidden moral or symbolic meaning.',
    category: 'arts-culture',
  },
  {
    id: 'avant-garde',
    word: 'avant-garde',
    definition: 'New and experimental ideas, especially in art, music, or literature.',
    category: 'arts-culture',
  },
  {
    id: 'juxtaposition',
    word: 'juxtaposition',
    definition: 'The placing of two very different things close together for contrast.',
    category: 'arts-culture',
  },
  {
    id: 'motif',
    word: 'motif',
    definition: 'A recurring image, idea, or theme in a creative work.',
    category: 'arts-culture',
  },
  {
    id: 'provenance',
    word: 'provenance',
    definition: 'The origin or documented history of an object, especially a work of art.',
    category: 'arts-culture',
  },
  {
    id: 'surreal',
    word: 'surreal',
    definition: 'Having a strange, dreamlike quality that feels beyond ordinary reality.',
    category: 'arts-culture',
  },
  {
    id: 'virtuoso',
    word: 'virtuoso',
    definition: 'A person with exceptional skill in an art, especially music.',
    category: 'arts-culture',
  },

  // science-tech
  {
    id: 'algorithm',
    word: 'algorithm',
    definition: 'A precise set of steps followed to solve a problem or complete a task.',
    category: 'science-tech',
  },
  {
    id: 'catalyst',
    word: 'catalyst',
    definition: 'Something that triggers or speeds up a significant change.',
    category: 'science-tech',
  },
  {
    id: 'hypothesis',
    word: 'hypothesis',
    definition:
      'A proposed explanation, based on limited evidence, used as a starting point for further study.',
    category: 'science-tech',
  },
  {
    id: 'iterate',
    word: 'iterate',
    definition: 'To repeat a process, refining the result a little more each time.',
    category: 'science-tech',
  },
  {
    id: 'synthesis',
    word: 'synthesis',
    definition: 'The combining of separate ideas or elements into a coherent whole.',
    category: 'science-tech',
  },
  {
    id: 'ubiquitous',
    word: 'ubiquitous',
    definition: 'Seeming to be present everywhere at once.',
    category: 'science-tech',
  },
  {
    id: 'quantum-leap',
    word: 'quantum leap',
    definition: 'A sudden, dramatic advance or improvement.',
    category: 'science-tech',
  },
  {
    id: 'paradigm-shift',
    word: 'paradigm shift',
    definition: 'A fundamental change in the basic assumptions or approach within a field.',
    category: 'science-tech',
  },

  // current-events
  {
    id: 'polarize',
    word: 'polarize',
    definition: 'To split people into two sharply opposing groups or viewpoints.',
    category: 'current-events',
  },
  {
    id: 'consensus',
    word: 'consensus',
    definition: 'A general agreement reached by a group after discussion.',
    category: 'current-events',
  },
  {
    id: 'geopolitical',
    word: 'geopolitical',
    definition: 'Relating to politics as shaped by geography and international relations.',
    category: 'current-events',
  },
  {
    id: 'partisan',
    word: 'partisan',
    definition: 'Strongly favoring one side of a cause or party, often without questioning it.',
    category: 'current-events',
  },
  {
    id: 'transparency',
    word: 'transparency',
    definition: 'Openness in how decisions or actions are made and communicated.',
    category: 'current-events',
  },
  {
    id: 'accountability',
    word: 'accountability',
    definition: "Being responsible for one's actions and answerable for the outcome.",
    category: 'current-events',
  },
  {
    id: 'grassroots',
    word: 'grassroots',
    definition: 'Originating from ordinary people rather than from leadership or institutions.',
    category: 'current-events',
  },
  {
    id: 'incumbent',
    word: 'incumbent',
    definition: 'The person who currently holds a particular office or position.',
    category: 'current-events',
  },

  // travel
  {
    id: 'itinerary',
    word: 'itinerary',
    definition: 'A detailed plan or route for a journey.',
    category: 'travel',
  },
  {
    id: 'cosmopolitan',
    word: 'cosmopolitan',
    definition: 'Familiar with and comfortable in many different countries and cultures.',
    category: 'travel',
  },
  {
    id: 'picturesque',
    word: 'picturesque',
    definition: 'Visually charming or striking enough to look like a painting.',
    category: 'travel',
  },
  {
    id: 'sojourn',
    word: 'sojourn',
    definition: 'A temporary stay somewhere before moving on.',
    category: 'travel',
  },
  {
    id: 'wanderlust',
    word: 'wanderlust',
    definition: 'A strong, persistent desire to travel and explore.',
    category: 'travel',
  },
  {
    id: 'expedition',
    word: 'expedition',
    definition: 'A journey undertaken by a group for a specific purpose, such as exploration.',
    category: 'travel',
  },
  {
    id: 'quaint',
    word: 'quaint',
    definition: 'Attractively unusual or old-fashioned in a charming way.',
    category: 'travel',
  },
  {
    id: 'immersive',
    word: 'immersive',
    definition: 'Deeply engaging, making you feel fully absorbed in an experience.',
    category: 'travel',
  },

  // food-cuisine
  {
    id: 'palate',
    word: 'palate',
    definition: "A person's ability to distinguish and appreciate different tastes.",
    category: 'food-cuisine',
  },
  {
    id: 'artisanal',
    word: 'artisanal',
    definition: 'Made in a traditional, skilled, small-scale way rather than by machine.',
    category: 'food-cuisine',
  },
  {
    id: 'umami',
    word: 'umami',
    definition:
      'A savory, rich taste sensation distinct from sweet, sour, salty, and bitter.',
    category: 'food-cuisine',
  },
  {
    id: 'gastronomy',
    word: 'gastronomy',
    definition: 'The art and study of good food and cooking.',
    category: 'food-cuisine',
  },
  {
    id: 'decadent',
    word: 'decadent',
    definition: 'Indulgently rich or luxurious, especially in food.',
    category: 'food-cuisine',
  },
  {
    id: 'rustic',
    word: 'rustic',
    definition: 'Simple and unpretentious, evoking the countryside.',
    category: 'food-cuisine',
  },
  {
    id: 'fusion',
    word: 'fusion',
    definition: 'A creative blend of culinary traditions from different cultures.',
    category: 'food-cuisine',
  },
  {
    id: 'connoisseur',
    word: 'connoisseur',
    definition:
      'A person with expert knowledge and refined taste in a particular field, often food or drink.',
    category: 'food-cuisine',
  },

  // sports-fitness
  {
    id: 'resilience',
    word: 'resilience',
    definition: 'The ability to recover quickly from setbacks or difficulty.',
    category: 'sports-fitness',
  },
  {
    id: 'endurance',
    word: 'endurance',
    definition: 'The capacity to withstand prolonged physical or mental effort.',
    category: 'sports-fitness',
  },
  {
    id: 'prodigy',
    word: 'prodigy',
    definition: 'A young person with exceptional natural talent.',
    category: 'sports-fitness',
  },
  {
    id: 'underdog',
    word: 'underdog',
    definition: 'A competitor given little chance of winning against a stronger opponent.',
    category: 'sports-fitness',
  },
  {
    id: 'momentum',
    word: 'momentum',
    definition: 'The driving force gained by movement or by a developing situation.',
    category: 'sports-fitness',
  },
  {
    id: 'tenacity',
    word: 'tenacity',
    definition: 'Firm persistence in pursuing a goal despite difficulty.',
    category: 'sports-fitness',
  },
  {
    id: 'camaraderie',
    word: 'camaraderie',
    definition: 'A spirit of friendship and mutual trust among people who share an experience.',
    category: 'sports-fitness',
  },
  {
    id: 'peak-performance',
    word: 'peak performance',
    definition: 'The highest level of ability or output a person can achieve.',
    category: 'sports-fitness',
  },

  // family-relationships
  {
    id: 'rapport',
    word: 'rapport',
    definition: 'A close, harmonious relationship built on mutual understanding.',
    category: 'family-relationships',
  },
  {
    id: 'candid',
    word: 'candid',
    definition: 'Truthful and direct, without holding back.',
    category: 'family-relationships',
  },
  {
    id: 'empathy',
    word: 'empathy',
    definition: 'The ability to understand and share what someone else is feeling.',
    category: 'family-relationships',
  },
  {
    id: 'reconcile',
    word: 'reconcile',
    definition: 'To restore a friendly relationship after a disagreement.',
    category: 'family-relationships',
  },
  {
    id: 'nostalgia',
    word: 'nostalgia',
    definition: 'A wistful, sentimental longing for the past.',
    category: 'family-relationships',
  },
  {
    id: 'solidarity',
    word: 'solidarity',
    definition: 'A sense of unity and mutual support within a group.',
    category: 'family-relationships',
  },
  {
    id: 'vulnerable',
    word: 'vulnerable',
    definition: 'Emotionally open and exposed to being hurt.',
    category: 'family-relationships',
  },
  {
    id: 'affinity',
    word: 'affinity',
    definition: 'A natural liking, connection, or attraction toward someone or something.',
    category: 'family-relationships',
  },
];
