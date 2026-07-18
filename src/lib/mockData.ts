export const AI_COMMENT_SUGGESTIONS = (caption: string): string[] => {
  const suggestions = [
    `This is absolutely breathtaking! The way you've captured this moment is truly special ✨`,
    `Wow, this really speaks to me! Your eye for detail is incredible 👏`,
    `This made my day! Thank you for sharing such beautiful content with us 🌟`,
    `I love everything about this! The composition, the colors — perfection 💖`,
    `Can't stop looking at this! You have an incredible talent 🙌`,
    `This is giving me all the feels! Such an inspiring post 💫`,
  ];
  return suggestions.slice(0, 3);
};

export const AI_CAPTIONS = [
  {
    caption: 'Chasing light and finding magic in the everyday moments ✨',
    hashtags: '#photography #goldenhour #nature #wanderlust #photooftheday',
    emojis: '✨🌅📸',
  },
  {
    caption: 'Some moments are too beautiful not to share with the world 🌍',
    hashtags: '#travel #explore #adventure #inspo #life',
    emojis: '🌍✈️💫',
  },
  {
    caption: 'Creating is my love language. Every piece tells a story 🎨',
    hashtags: '#art #creative #design #digital #inspiration',
    emojis: '🎨✨💖',
  },
];
