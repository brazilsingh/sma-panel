'use strict';
// Platform reach and media guide. Researched 2026-11-22. Sources listed per platform.
// Specs marked null are unconfirmed from an official or reliable source; see each note.
const PLATFORM_GUIDE = {
  updated: '2026-11-22',
  platforms: [
    {
      name: 'LinkedIn',
      summary: 'Native document (PDF) carousels lead engagement, followed by multi-image and native video; link posts and polls trail.',
      reach: [
        { format: 'Document carousel (PDF)', why: 'Swipeable slides keep people on the post and invite saves.', evidence: 'Buffer: median engagement 21.77% for carousels vs 7.35% video, 6.52% images, 3.81% links, 3.18% text. Socialinsider: documents 7.00% (2025), highest format, up 14% YoY.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Multi-image post', why: 'Strong for likes, especially on larger pages.', evidence: 'Socialinsider 2026 benchmarks: multi-image 6.45% engagement in 2025, ahead of video 6.00% and single image 5.30%.', source: 'https://www.socialinsider.io/social-media-benchmarks/linkedin', sourceDate: '2026' },
        { format: 'Native video', why: 'LinkedIn is pushing video; watch time is growing.', evidence: 'LinkedIn cited 36% YoY growth (uploads/watch time) and video creation growing twice as fast as other formats. Socialinsider notes average video views down 36% YoY, so reach per video is falling as supply rises.', source: 'https://techcrunch.com/2025/02/04/linkedin-amps-up-vertical-video-tools-as-uploads-jump-36', sourceDate: '2025-02' },
        { format: 'Single image', why: 'Reliable middle performer.', evidence: 'Buffer median 6.52%; Socialinsider 5.30%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Link post', why: 'Sends people off platform; consistently near the bottom.', evidence: 'Buffer median 3.81% for link posts vs 21.77% for carousels. LinkedIn has not confirmed a formal link penalty; third-party estimates of the reach cut vary widely.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' }
      ],
      tips: [
        'Turn articles into a 6 to 12 slide PDF carousel with one idea per slide.',
        'Put the hook in the first ~200 characters, before the "see more" cut.',
        'Upload video natively with captions; keep key text away from the edges.',
        'If a link is needed, test link in first comment vs in post; evidence is mixed.',
        'A post can carry a URL preview or an image, not both.'
      ],
      specs: {
        images: [
          { use: 'Link preview (custom image)', size: '1200 x 627', ratio: '1.91:1', maxFile: '3 MB', formats: 'JPG, PNG', note: 'Official: over 200 px wide, 1.91:1.' },
          { use: 'Page logo', size: '400 x 400', ratio: '1:1', maxFile: '3 MB', formats: 'JPG, PNG', note: 'Minimum 268 x 268.' },
          { use: 'Page cover', size: '1512 x 256', ratio: '5.9:1', maxFile: '3 MB', formats: 'JPG, PNG', note: '' },
          { use: 'Feed image (portrait/square)', size: null, ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'LinkedIn Help publishes no pixel size for ordinary feed images; 1080 x 1350 (4:5) or 1080 x 1080 are common practice, unconfirmed.' }
        ],
        gif: { supported: true, maxFile: null, note: 'GIFs post as images; size limit unconfirmed.' },
        video: [
          { use: 'Feed', ratio: '1:2.4 to 2.4:1', size: '256x144 to 4096x2304', length: '3 s (2 s mobile) to 15 min', maxFile: '5 GB (min 75 KB)', formats: null, note: '10 to 60 fps, 192 Kbps to 30 Mbps. Cannot post directly to the vertical video feed. Formats not listed on the help page.' }
        ],
        carousel: { maxItems: 300, note: 'Document posts: PDF, PPT/PPTX, DOC/DOCX, up to 100 MB and 300 pages (widely reported, not on an official page found). Multi-image post count unconfirmed.' },
        text: { post: 3000, comment: 1250, title: null, altText: null, note: 'Post 3000 is on LinkedIn Help; comment 1250 is third-party reported. Alt text limit unconfirmed (120 in-app per accessibility guides, 4086 in API).' },
        hashtags: '0 to 3 relevant tags; not a reach lever.',
        links: 'Link posts get the lowest engagement; first-comment link is common but untested at scale.'
      },
      sources: [
        { title: 'Buffer: Best content format on social platforms in 2026', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' },
        { title: 'Socialinsider 2026 LinkedIn benchmarks', url: 'https://www.socialinsider.io/social-media-benchmarks/linkedin', date: '2026' },
        { title: 'LinkedIn Help: share videos', url: 'https://www.linkedin.com/help/linkedin/answer/a7486279', date: '2026' },
        { title: 'LinkedIn Help: Page image specifications', url: 'https://www.linkedin.com/help/linkedin/answer/a563309', date: '2026' },
        { title: 'TechCrunch: LinkedIn video uploads up 36%', url: 'https://techcrunch.com/2025/02/04/linkedin-amps-up-vertical-video-tools-as-uploads-jump-36', date: '2025-02' }
      ]
    },
    {
      name: 'X',
      summary: 'Text posts lead engagement; links from non-Premium accounts get almost no engagement since March 2025.',
      reach: [
        { format: 'Text post', why: 'Native conversation format; highest median engagement.', evidence: 'Buffer (18.8M posts): text ~0.40% engagement for regular accounts, ~0.90% for Premium. Buffer 2026 format study: text 3.56% median.', source: 'https://buffer.com/resources/links-on-x/', sourceDate: '2025-10' },
        { format: 'Image post', why: 'Close second to text.', evidence: 'Buffer 2026: images 3.40% median vs video 2.96%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Video', why: 'Works better for Premium accounts.', evidence: 'Premium video ~0.85% vs regular ~0.25%.', source: 'https://buffer.com/resources/links-on-x/', sourceDate: '2025-10' },
        { format: 'Link post', why: 'Weakest format; regular accounts are effectively invisible.', evidence: 'Median engagement for non-Premium link posts stuck at 0% since March 2025; Premium ~0.28%. Premium accounts reach about 10x the audience.', source: 'https://buffer.com/resources/links-on-x/', sourceDate: '2025-10' }
      ],
      tips: [
        'Lead with a standalone text or image post; add the link in a reply.',
        'Premium status materially changes reach and video limits.',
        'Expect high variance: a few posts drive most results.',
        'Add alt text to every image (up to 1000 characters).'
      ],
      specs: {
        images: [
          { use: 'Feed (up to 4 per post)', size: null, ratio: null, maxFile: '5 MB', formats: 'JPG, PNG, GIF, WEBP', note: 'Official docs give no pixel size; 16:9 or 1:1 common, unconfirmed.' },
          { use: 'Link card', size: null, ratio: null, maxFile: null, formats: null, note: 'Driven by page Open Graph / Twitter Card tags; size unconfirmed.' }
        ],
        gif: { supported: true, maxFile: '15 MB', note: '1 GIF per post. Recommended up to 1280x1080, 350 frames.' },
        video: [
          { use: 'Post (default)', ratio: '1:3 to 3:1 (16:9 or 1:1 recommended)', size: '32x32 to 1280x1024 required; 1280x720 / 720x1280 / 720x720 recommended', length: '0.5 s to 20 min', maxFile: '8 GB', formats: 'MP4, MOV', note: 'API docs. Max 60 fps, YUV 4:2:0.' },
          { use: 'Post (Premium)', ratio: '1:3 to 3:1', size: 'as above', length: '0.5 s to 125 min', maxFile: '16 GB', formats: 'MP4, MOV', note: 'Press reports free users at 140 s in the app; API docs say 20 min. Conflict noted.' }
        ],
        carousel: { maxItems: 4, note: 'Up to 4 images, or 1 GIF, or 1 video.' },
        text: { post: 280, comment: 280, title: null, altText: 1000, note: 'Premium posts up to 25,000 characters.' },
        hashtags: '0 to 2; not a reach driver.',
        links: 'Link posts near-zero for non-Premium; put link in a reply.'
      },
      sources: [
        { title: 'Buffer: Do posts with links affect performance on X?', url: 'https://buffer.com/resources/links-on-x/', date: '2025-10' },
        { title: 'X API media best practices', url: 'https://docs.x.com/x-api/media/quickstart/best-practices', date: '2026' },
        { title: 'X Help: image descriptions', url: 'https://help.x.com/en/using-x/write-image-descriptions', date: '2026' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' }
      ]
    },
    {
      name: 'Facebook',
      summary: 'Original Reels and image posts lead; link posts are weakest and Meta is testing link caps for some Pages.',
      reach: [
        { format: 'Original Reels', why: 'Meta is boosting original content and cutting reach for reposted material.', evidence: 'Meta: views and time spent on original Reels roughly doubled in H2 2025 vs 2024. Socialinsider: Reels engagement 0.18% in 2025, up from 0.13%.', source: 'https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/', sourceDate: '2026-03' },
        { format: 'Image post', why: 'Top median engagement in Buffer data.', evidence: 'Buffer 2026: images 5.20% vs video 4.84%, text 4.76%, links 4.43%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Status (text) and albums', why: 'Conversation and multi-photo posts hold up for Pages.', evidence: 'Socialinsider 2025: status 0.20%, albums 0.18%, images 0.15%, links 0.05%.', source: 'https://www.socialinsider.io/social-media-benchmarks/facebook', sourceDate: '2026-03' },
        { format: 'Link post', why: 'Lowest engagement; possible posting caps.', evidence: 'Dec 2025 test capped some Pages and professional profiles without Meta Verified at 2 organic link posts per month; links in comments exempt.', source: 'https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages', sourceDate: '2025-12' }
      ],
      tips: [
        'Post original vertical video; avoid reposting others\' clips.',
        'Use image or album posts for announcements, link in first comment.',
        'Check whether your Page is in the link-cap test before scheduling many links.',
        'Set og:image to 1200 x 630 on the target page for clean link previews.'
      ],
      specs: {
        images: [
          { use: 'Link preview (og:image)', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Minimum 600 x 315 for large preview.' },
          { use: 'Feed (portrait)', size: null, ratio: '4:5', maxFile: null, formats: 'JPG, PNG', note: 'Official organic feed image spec not found; 1080 x 1350 is common practice, unconfirmed.' },
          { use: 'Reel cover', size: '1080 x 1920', ratio: '9:16', maxFile: null, formats: 'JPG, PNG', note: 'Unconfirmed official.' }
        ],
        gif: { supported: true, maxFile: null, note: 'Supported in posts and comments; limits unconfirmed.' },
        video: [
          { use: 'Reel (API)', ratio: '9:16', size: '1080 x 1920 recommended, min 540 x 960', length: '3 to 90 s', maxFile: null, formats: 'MP4', note: 'Meta Reels Publishing API; 24 to 60 fps. In-app Reels may run longer; unconfirmed.' },
          { use: 'Feed video', ratio: null, size: null, length: null, maxFile: null, formats: 'MP4, MOV', note: 'Unconfirmed.' }
        ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Commonly cited 63,206 post limit not confirmed from an official page.' },
        hashtags: '0 to 3; minor effect.',
        links: 'Lowest-engagement format; test link caps; first comment is the common workaround.'
      },
      sources: [
        { title: 'Meta: Rewarding original creators on Facebook', url: 'https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/', date: '2026-03' },
        { title: 'Socialinsider 2026 Facebook benchmarks', url: 'https://www.socialinsider.io/social-media-benchmarks/facebook', date: '2026-03' },
        { title: 'TechCrunch: Facebook tests link posting limit', url: 'https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages', date: '2025-12' },
        { title: 'Meta Reels Publishing API', url: 'https://developers.facebook.com/docs/video-api/guides/reels-publishing', date: '2026' },
        { title: 'Meta sharing images guide', url: 'https://developers.facebook.com/docs/sharing/webmasters/images/', date: '2026' }
      ]
    },
    {
      name: 'Instagram',
      summary: 'Reels bring the most reach to new audiences; carousels earn the highest engagement per viewer.',
      reach: [
        { format: 'Reels (90 s to 3 min)', why: 'Only Reels of 3 min or less are recommended to non-followers.', evidence: 'Buffer (2.7M Reels, 2026): 90 to 179 s reached +7.4% vs account average; 180 s+ reached -49.3%. Reels reach 1.36x carousels and 2.25x single images.', source: 'https://buffer.com/resources/instagram-reels-length', sourceDate: '2026-11' },
        { format: 'Carousel', why: 'Highest engagement as share of reach; slides get re-served.', evidence: 'Buffer: carousels 6.9% engagement vs images 4.4%, Reels 3.3%. Socialinsider 2025: carousels 0.55% vs Reels 0.52%, images 0.37%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Content that gets sent (DM shares)', why: 'Sends weigh most for reaching non-followers.', evidence: 'Mosseri: top ranking signals are watch time, likes and sends; sends matter more for unconnected reach.', source: 'https://www.socialmediatoday.com/news/instagram-shares-algorithm-2025/738034/', sourceDate: '2025-01' },
        { format: 'Single image', why: 'Declining; lowest per-reach engagement.', evidence: 'Socialinsider: image engagement fell 18% in 2025.', source: 'https://www.socialinsider.io/social-media-benchmarks/instagram', sourceDate: '2026' }
      ],
      tips: [
        'Keep Reels at or under 3 minutes to stay eligible for recommendations.',
        'Use carousels for explainers; first slide sets the aspect ratio.',
        'Use up to 5 specific hashtags (hard cap since Dec 2025).',
        'Design for 4:5 in feed but keep key content inside a 3:4 grid crop.',
        'Add alt text to images (up to 1000 characters via API).'
      ],
      specs: {
        images: [
          { use: 'Feed (portrait)', size: '1080 x 1350', ratio: '4:5', maxFile: '8 MB', formats: 'JPG', note: 'API accepts 4:5 to 1.91:1, width 320 to 1440 px.' },
          { use: 'Feed (square)', size: '1080 x 1080', ratio: '1:1', maxFile: '8 MB', formats: 'JPG', note: '' },
          { use: 'Feed (3:4, app only)', size: '1080 x 1440', ratio: '3:4', maxFile: null, formats: 'JPG, PNG', note: 'Reported for the app since 2025; not in API docs; unconfirmed.' },
          { use: 'Story', size: '1080 x 1920', ratio: '9:16', maxFile: '8 MB', formats: 'JPG', note: '' },
          { use: 'Reel cover', size: '1080 x 1920', ratio: '9:16', maxFile: '8 MB', formats: 'JPG', note: '' }
        ],
        gif: null,
        video: [
          { use: 'Reel', ratio: '9:16 recommended', size: '1080 x 1920 (max width 1920)', length: '3 s to 15 min (API); up to 20 min in app (rolling out)', maxFile: '300 MB (API)', formats: 'MP4, MOV', note: 'Over 3 min not recommended to new audiences.' },
          { use: 'Story', ratio: '9:16', size: '1080 x 1920', length: '3 to 60 s', maxFile: '100 MB', formats: 'MP4, MOV', note: 'API limits.' }
        ],
        carousel: { maxItems: 20, note: 'Images, videos or mix; Reels cannot be carousel items.' },
        text: { post: 2200, comment: null, title: null, altText: 1000, note: 'Max 20 @mentions. Comment limit unconfirmed.' },
        hashtags: 'Max 5 per post or Reel (since Dec 2025).',
        links: 'Caption links are not clickable; use bio link, Story link sticker or DM.'
      },
      sources: [
        { title: 'Buffer: Instagram Reels length (2.7M Reels)', url: 'https://buffer.com/resources/instagram-reels-length', date: '2026-11' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' },
        { title: 'Socialinsider 2026 Instagram benchmarks', url: 'https://www.socialinsider.io/social-media-benchmarks/instagram', date: '2026' },
        { title: 'Instagram Graph API: IG User media', url: 'https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media', date: '2026' },
        { title: 'Social Media Today: Instagram hashtag limit', url: 'https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/', date: '2025-12' }
      ]
    },
    {
      name: 'Threads',
      summary: 'Video and image posts lead engagement; replies drive distribution; link posts trail.',
      reach: [
        { format: 'Video', why: 'Highest median engagement.', evidence: 'Buffer 2026: video 5.55% vs images 4.55%, text 2.79%, links 2.34%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Image post', why: 'Strong second.', evidence: 'Images 4.55% median.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Conversation starters (text)', why: 'Threads engages better than X overall; replies are a key signal.', evidence: 'Buffer (10.2M posts, 2024): Threads 6.25% median engagement vs X 3.6% (73.6% higher).', source: 'https://buffer.com/resources/threads-vs-x', sourceDate: '2025-02' },
        { format: 'Link post', why: 'Lowest format in Buffer data.', evidence: 'Links 2.34% median.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' }
      ],
      tips: [
        'Add one topic tag that matches the post.',
        'Reply to comments quickly to extend the conversation.',
        'Use a text attachment (up to 10,000 characters) for long-form instead of a link.',
        'Use 9:16 video to avoid cropping.'
      ],
      specs: {
        images: [
          { use: 'Feed', size: null, ratio: 'up to 10:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Min width 320 px; over 4096 px scaled down. No preferred size published.' }
        ],
        gif: { supported: null, maxFile: null, note: 'Unconfirmed via API.' },
        video: [
          { use: 'Feed', ratio: '9:16 recommended (0.01:1 to 10:1)', size: 'max width 1920', length: 'up to 5 min', maxFile: '1 GB', formats: 'MP4, MOV', note: '23 to 60 fps, H.264 or HEVC.' }
        ],
        carousel: { maxItems: 20, note: '2 to 20 images or videos (API).' },
        text: { post: 500, comment: 500, title: null, altText: null, note: 'Text attachment up to 10,000 characters on text-only posts. Max 5 links per post. Alt text limit unconfirmed.' },
        hashtags: 'One topic tag per post (1 to 50 characters).',
        links: 'Links allowed (max 5) but underperform; keep most posts link-free.'
      },
      sources: [
        { title: 'Threads API: Posts', url: 'https://developers.facebook.com/documentation/threads/posts', date: '2026' },
        { title: 'Meta: Attach text to Threads posts', url: 'https://about.fb.com/news/2025/09/attach-text-threads-posts-share-longer-perspectives/', date: '2025-09' },
        { title: 'Buffer: Threads vs X', url: 'https://buffer.com/resources/threads-vs-x', date: '2025-02' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' }
      ]
    },
    {
      name: 'TikTok',
      summary: 'Video beats photo carousels on engagement, and longer videos (over 60 s) tend to get more reach.',
      reach: [
        { format: 'Video', why: 'Core format; highest median engagement.', evidence: 'Buffer 2026: video 3.39% median vs carousels/photos 1.92% (77% higher).', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Longer video (over 60 s)', why: 'Reach tends to rise with length.', evidence: 'Buffer: biggest reach jump past 60 seconds, though length is not decisive.', source: 'https://buffer.com/resources/longer-tiktoks-get-more-views-data/', sourceDate: '2025' },
        { format: 'Photo mode carousel', why: 'Useful for list and tutorial content; lower median engagement.', evidence: 'Buffer: 1.92% median. Older Metricool data showed higher image engagement; sources conflict.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' }
      ],
      tips: [
        'Hook in the first seconds; test 1 to 3 minute videos.',
        'Use on-screen text and captions; TikTok is used as a search engine.',
        'Keep key elements out of the right and bottom UI zones.',
        'Use photo mode for step-by-step lists as a secondary format.'
      ],
      specs: {
        images: [
          { use: 'Photo mode', size: '1080 x 1920', ratio: '9:16', maxFile: '20 MB', formats: 'JPG, WEBP', note: 'API max 1080p.' }
        ],
        gif: null,
        video: [
          { use: 'Feed', ratio: '9:16', size: '1080 x 1920 (360 to 4096 px)', length: '3 min for all; 5 or 10 min for some creators via API', maxFile: '4 GB', formats: 'MP4, WebM, MOV', note: 'App uploads up to 60 min reported, unconfirmed.' }
        ],
        carousel: { maxItems: 35, note: 'Photo mode up to 35 images (reported; API sources conflict).' },
        text: { post: 2200, comment: null, title: 90, altText: null, note: 'API video caption 2200 UTF-16 runes; photo description 4000, photo title 90. In-app limit and comment limit unconfirmed.' },
        hashtags: '3 to 5 relevant tags; keywords in caption matter for search.',
        links: 'No clickable links in captions; bio link only (eligibility rules apply).'
      },
      sources: [
        { title: 'TikTok Content Posting API: media transfer', url: 'https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide', date: '2026' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' },
        { title: 'Buffer: Longer TikToks get more views', url: 'https://buffer.com/resources/longer-tiktoks-get-more-views-data/', date: '2025' }
      ]
    },
    {
      name: 'Pinterest',
      summary: 'Video Pins earn the highest engagement; keyword-rich 2:3 image Pins remain the reach base.',
      reach: [
        { format: 'Video Pin', why: 'Highest median engagement.', evidence: 'Buffer 2026: video 5.75% vs images 3.15%.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Standard 2:3 image Pin with keywords', why: 'Pinterest is search-driven; titles and descriptions drive delivery.', evidence: 'Pinterest: description is not shown in feeds but is used for relevance; add keywords for search visibility.', source: 'https://help.pinterest.com/business/article/pinterest-product-specs', sourceDate: '2026' }
      ],
      tips: [
        'Use 1000 x 1500 (2:3); taller Pins may be cut off.',
        'Front-load keywords in the first 40 characters of the title.',
        'Keep video 6 to 15 seconds (Pinterest recommendation).',
        'Always attach a destination link; Pinterest is a traffic platform.'
      ],
      specs: {
        images: [
          { use: 'Standard Pin', size: '1000 x 1500', ratio: '2:3', maxFile: '20 MB (32 MB in app)', formats: 'JPG, PNG', note: '' },
          { use: 'Carousel card', size: null, ratio: '1:1 or 2:3', maxFile: '20 MB', formats: 'JPG, PNG', note: '' }
        ],
        gif: { supported: null, maxFile: null, note: 'Unconfirmed.' },
        video: [
          { use: 'Video Pin', ratio: '1:2 to 1.91:1 (1:1, 2:3, 4:5, 9:16 recommended)', size: null, length: '4 s to 15 min (6 to 15 s recommended)', maxFile: '2 GB', formats: 'MP4, MOV, M4V', note: 'H.264 or H.265.' }
        ],
        carousel: { maxItems: 5, note: '2 to 5 images (ad spec page; Sales objective 2 to 10).' },
        text: { post: 800, comment: null, title: 100, altText: null, note: 'Description 800; first 40 title characters show in feed.' },
        hashtags: 'Not needed; use keywords.',
        links: 'Links are core and do not cut reach.'
      },
      sources: [
        { title: 'Pinterest product specs', url: 'https://help.pinterest.com/business/article/pinterest-product-specs', date: '2026' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' }
      ]
    },
    {
      name: 'Bluesky',
      summary: 'Video gets the most interactions in early data; audiences are niche and steady rather than viral.',
      reach: [
        { format: 'Video', why: 'Most interactions per post in small sample.', evidence: 'Buffer 2026: video median 5 interactions vs images 4, links and text 3 (early data).', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Image post', why: 'Second in interactions.', evidence: 'Median 4 interactions.', source: 'https://buffer.com/resources/data-best-content-format-social-media/', sourceDate: '2026-03' },
        { format: 'Niche text and link posts', why: 'Chronological feeds and custom feeds; links are not penalised by a known algorithm.', evidence: 'Buffer (1.7M posts): Bluesky median 3 to 4 engagements; smaller but reliable.', source: 'https://buffer.com/resources/x-threads-bluesky-data/', sourceDate: '2025-03' }
      ],
      tips: [
        'Post into topic custom feeds your audience follows.',
        'Write full alt text; the community expects it.',
        'Links count toward 300 characters; keep URLs short.'
      ],
      specs: {
        images: [
          { use: 'Feed (up to 4)', size: null, ratio: null, maxFile: null, formats: 'JPG, PNG', note: 'Per-image size limit unconfirmed (sources say about 1 to 2 MB).' }
        ],
        gif: { supported: true, maxFile: null, note: 'Handling unconfirmed; sources conflict on whether GIFs animate.' },
        video: [
          { use: 'Feed', ratio: null, size: null, length: 'up to 10 min', maxFile: '300 MB', formats: 'MP4', note: 'Raised Aug 2026 (from 3 min, 100 MB). One video per post; cannot mix with images.' }
        ],
        carousel: { maxItems: 4, note: 'Up to 4 images.' },
        text: { post: 300, comment: 300, title: null, altText: 2000, note: 'Reported by multiple third-party sources.' },
        hashtags: 'Optional; 1 to 2 tags.',
        links: 'No known link penalty; link cards supported.'
      },
      sources: [
        { title: 'Engadget: Bluesky supports 10-minute videos', url: 'https://engadget.com/2244638/bluesky-now-supports-10-minute-videos-larger-file-sizes/', date: '2026-08' },
        { title: 'Buffer 2026 content format study', url: 'https://buffer.com/resources/data-best-content-format-social-media/', date: '2026-03' },
        { title: 'Buffer: 1.7M posts from X, Threads, Bluesky', url: 'https://buffer.com/resources/x-threads-bluesky-data/', date: '2025-03' },
        { title: 'SocialBee: Bluesky content guidelines', url: 'https://socialbee.com/blog/bluesky-content-guidelines/', date: '2025' }
      ]
    },
    {
      name: 'Mastodon',
      summary: 'Chronological, no algorithm: plain text with alt-texted images and relevant hashtags is how posts are found.',
      reach: [
        { format: 'Text with hashtags', why: 'Hashtags are the main discovery path; no ranking algorithm.', evidence: 'No dated reach study found; based on platform design.', source: 'https://docs.joinmastodon.org/user/posting/', sourceDate: '2026' }
      ],
      tips: ['Use CamelCase hashtags for accessibility.', 'Always add alt text.', 'Limits vary by server; check your instance.'],
      specs: {
        images: [ { use: 'Feed (up to 4)', size: null, ratio: null, maxFile: '16 MB', formats: 'JPG, PNG, GIF, WEBP', note: 'Downscaled to about 8.3 MP.' } ],
        gif: { supported: true, maxFile: null, note: 'Converted to video; limit unconfirmed.' },
        video: [ { use: 'Feed', ratio: null, size: null, length: null, maxFile: '99 MB', formats: 'MP4, WEBM, MOV', note: 'Software default (about 99 MiB); instances can change.' } ],
        carousel: { maxItems: 4, note: '' },
        text: { post: 500, comment: 500, title: null, altText: null, note: 'Default 500; instances may raise it. Alt text limit unconfirmed.' },
        hashtags: '2 to 5 relevant tags; essential for discovery.',
        links: 'No penalty; link previews supported.'
      },
      sources: [ { title: 'Mastodon docs: posting', url: 'https://docs.joinmastodon.org/user/posting/', date: '2026' } ]
    },
    {
      name: 'Reddit',
      summary: 'Community-native text and image posts that follow subreddit rules win; repeated self-promotional links fail.',
      reach: [
        { format: 'Community-native discussion post', why: 'Votes and comments decide visibility; promotion is policed by moderators.', evidence: 'Reddit marketing lead: test and learn; Reddit says brands should post what members want to discuss.', source: 'https://blog.hootsuite.com/reddit-for-business/', sourceDate: '2025' },
        { format: 'Own-link posts', why: 'Accounts that mostly post their own links look like spam.', evidence: 'Reddit self-promotion guidance as summarised by third parties; current official text not found.', source: 'https://blog.hubspot.com/marketing/reddit-marketing', sourceDate: '2025' }
      ],
      tips: ['Read each subreddit sidebar for link and promo rules.', 'Disclose affiliation.', 'Keep visuals plain; polished ads feel out of place.', 'Titles cannot be edited after posting.'],
      specs: {
        images: [ { use: 'Image post / gallery', size: null, ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'Size limits unconfirmed officially.' } ],
        gif: { supported: true, maxFile: null, note: 'Unconfirmed.' },
        video: [ { use: 'Native video', ratio: null, size: null, length: 'up to 15 min', maxFile: '1 GB', formats: 'MP4, MOV', note: 'Third-party API docs; subreddits may block video.' } ],
        carousel: { maxItems: 20, note: 'Gallery up to 20 per third-party docs; another source says 10. Unconfirmed.' },
        text: { post: 40000, comment: 10000, title: 300, altText: null, note: 'Title 300 and body 40,000 per third-party docs (one says 30,000). Comment 10,000 unconfirmed.' },
        hashtags: 'Not used.',
        links: 'Allowed where the subreddit permits; heavy self-linking gets removed.'
      },
      sources: [
        { title: 'Zernio Reddit platform docs', url: 'https://docs.zernio.com/platforms/reddit', date: '2026' },
        { title: 'Hootsuite: Reddit for business', url: 'https://blog.hootsuite.com/reddit-for-business/', date: '2025' }
      ]
    },
    {
      name: 'Snapchat',
      summary: 'Vertical full-screen video for Spotlight and Stories; short, native, sound-on.',
      reach: [ { format: 'Spotlight vertical video', why: 'Algorithmic surface for non-followers.', evidence: 'No dated reach study found.', source: 'https://moda.app/resources/sizes/snapchat-spotlight', sourceDate: '2026-03' } ],
      tips: ['Keep content centred; UI overlays top, right and bottom.', 'Shoot native 9:16.'],
      specs: {
        images: [ { use: 'Story / Spotlight', size: '1080 x 1920', ratio: '9:16', maxFile: null, formats: 'JPG, PNG', note: 'Third-party.' } ],
        gif: null,
        video: [ { use: 'Spotlight', ratio: '9:16', size: '1080 x 1920', length: '5 to 60 s', maxFile: null, formats: 'MP4', note: 'Third-party; file size 500 MB or 1 GB reported, unconfirmed.' } ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' },
        hashtags: 'Topic tags on Spotlight; few.',
        links: 'Link stickers on Stories; unconfirmed reach effect.'
      },
      sources: [ { title: 'Ayrshare Snapchat media guidelines', url: 'https://www.ayrshare.com/docs/media-guidelines/snapchat', date: '2026' }, { title: 'Moda: Snapchat Spotlight size', url: 'https://moda.app/resources/sizes/snapchat-spotlight', date: '2026-03' } ]
    },
    {
      name: 'Tumblr',
      summary: 'Reblog culture: visual posts with accurate tags travel furthest.',
      reach: [ { format: 'Tagged image and GIF posts', why: 'Tags drive discovery; only the first 20 tags are indexed.', evidence: 'No dated reach study found.', source: 'https://www.tumblr.com/docs/api/v2', sourceDate: '2026' } ],
      tips: ['Put the most important tags first.', 'GIFs and art travel well via reblogs.'],
      specs: {
        images: [ { use: 'Post image', size: null, ratio: null, maxFile: '20 MB', formats: 'JPG, PNG, GIF', note: 'Third-party; images per post 10 or 30 per sources, unconfirmed.' } ],
        gif: { supported: true, maxFile: null, note: 'Unconfirmed.' },
        video: [ { use: 'Post', ratio: null, size: null, length: null, maxFile: null, formats: 'MP4', note: 'API: 20 videos and 60 min of video per user per day.' } ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' },
        hashtags: 'Up to 30 tags; first 20 indexed.',
        links: 'No known penalty.'
      },
      sources: [ { title: 'Tumblr API v2', url: 'https://www.tumblr.com/docs/api/v2', date: '2026' } ]
    },
    {
      name: 'Quora',
      summary: 'Detailed, credible answers to specific questions earn long-tail search traffic.',
      reach: [ { format: 'Long-form answer', why: 'Answers rank in Quora and web search over time.', evidence: 'No dated reach study found.', source: 'https://www.quora.com/', sourceDate: null } ],
      tips: ['Answer the question in the first lines.', 'Link sparingly and only when relevant.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used; topics instead.', links: 'Over-linking can be flagged as spam (unconfirmed).' },
      sources: [ { title: 'Quora', url: 'https://www.quora.com/', date: null } ]
    },
    {
      name: 'XING',
      summary: 'DACH professional network; text and image posts on profiles and pages. Little current data.',
      reach: [ { format: 'Professional text and image posts', why: 'Similar to LinkedIn usage in German-speaking markets.', evidence: 'No dated reach study found.', source: 'https://www.xing.com/', sourceDate: null } ],
      tips: ['Post in German for DACH audiences.', 'Check specs in the composer; none confirmed.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Unconfirmed.', links: 'Unconfirmed.' },
      sources: [ { title: 'XING', url: 'https://www.xing.com/', date: null } ]
    },
    {
      name: 'Google Business Profile',
      summary: 'Fresh photos, offers and update posts support local search visibility.',
      reach: [ { format: 'Photos and update posts', why: 'Profile content shows in Search and Maps once verified.', evidence: 'Google: photos and videos appear only after verification. No dated reach study found.', source: 'https://support.google.com/business/answer/6103862', sourceDate: '2026' } ],
      tips: ['Verify the profile first.', 'Use well-lit, real photos of the business.', 'Add a CTA button to update posts.'],
      specs: {
        images: [ { use: 'Profile / post photo', size: '720 x 720', ratio: null, maxFile: '5 MB (min 10 KB)', formats: 'JPG, PNG', note: 'Min 250 x 250 (Google); 720 x 720 and file limits per third-party docs.' } ],
        gif: null,
        video: [ { use: 'Profile video', ratio: null, size: '720p or higher', length: 'up to 30 s', maxFile: null, formats: 'MP4', note: 'File limit 26 MB or 75 MB per conflicting sources; unconfirmed.' } ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Post limit (often cited 1500) unconfirmed.' },
        hashtags: 'Not used.',
        links: 'CTA button link per post; no penalty.'
      },
      sources: [ { title: 'Google Business Profile photo tips', url: 'https://support.google.com/business/answer/6103862', date: '2026' }, { title: 'Ayrshare GBP media guidelines', url: 'https://www.ayrshare.com/docs/media-guidelines/google-business-profile', date: '2026' } ]
    },
    {
      name: 'VK',
      summary: 'Short vertical video (Clips) and community posts. Specs not confirmed for this guide.',
      reach: [ { format: 'Clips (short video)', why: 'VK promotes short vertical video.', evidence: 'No dated reach study found; unconfirmed.', source: 'https://vk.com/', sourceDate: null } ],
      tips: ['Verify specs in the VK composer before publishing.'],
      specs: { images: [], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Unconfirmed.', links: 'Unconfirmed.' },
      sources: [ { title: 'VK', url: 'https://vk.com/', date: null } ]
    },
    {
      name: 'LINE',
      summary: 'Messaging-first: LINE Official Account broadcasts and VOOM posts. Specs not confirmed here.',
      reach: [ { format: 'Official Account broadcast with rich image', why: 'Direct delivery to followers.', evidence: 'No dated reach study found.', source: 'https://developers.line.biz/en/docs/messaging-api/', sourceDate: null } ],
      tips: ['Check Messaging API limits before automating.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Links allowed in messages.' },
      sources: [ { title: 'LINE Messaging API docs', url: 'https://developers.line.biz/en/docs/messaging-api/', date: null } ]
    },
    {
      name: 'Lemmy',
      summary: 'Federated Reddit-style communities; useful, on-topic posts with community norms.',
      reach: [ { format: 'Community link or text post', why: 'Votes decide visibility; no ad-driven algorithm.', evidence: 'No dated reach study found.', source: 'https://join-lemmy.org/docs/', sourceDate: null } ],
      tips: ['Read community rules; limits vary by instance.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Instance-dependent; unconfirmed.' }, hashtags: 'Not used.', links: 'Link posts are normal.' },
      sources: [ { title: 'Lemmy docs', url: 'https://join-lemmy.org/docs/', date: null } ]
    },
    {
      name: 'Telegram',
      summary: 'Channel posts reach all subscribers directly; concise text with one strong image or video works.',
      reach: [ { format: 'Channel post with media', why: 'No ranking algorithm; delivery is to subscribers.', evidence: 'No dated reach study found.', source: 'https://telegram.org/faq', sourceDate: null } ],
      tips: ['Keep media captions under 1024 characters (bots and non-Premium).', 'Use albums for multi-image posts.'],
      specs: {
        images: [], gif: { supported: true, maxFile: null, note: 'Sent as animation; unconfirmed limit.' },
        video: [ { use: 'Message / channel', ratio: null, size: null, length: null, maxFile: '2 GB', formats: 'MP4', note: 'User uploads up to 2 GB per Telegram discussions; Premium 4 GB unconfirmed.' } ],
        carousel: { maxItems: null, note: 'Album size unconfirmed (10 widely cited).' },
        text: { post: null, comment: null, title: null, altText: null, note: 'Captions 1024 (4096 for Premium users per Telegram staff on bug tracker); message limit (4096 widely cited) unconfirmed.' },
        hashtags: 'Optional; used for in-channel search.',
        links: 'Links fine; previews generated.'
      },
      sources: [ { title: 'Telegram bug tracker: caption limits', url: 'https://bugs.telegram.org/c/1022', date: '2024' } ]
    },
    {
      name: 'WhatsApp',
      summary: 'Channels and broadcasts deliver directly; short text with one image or short video.',
      reach: [ { format: 'Channel update with image', why: 'Direct delivery; no feed ranking.', evidence: 'No dated reach study found.', source: 'https://faq.whatsapp.com/', sourceDate: null } ],
      tips: ['Business API limits differ from the consumer app.'],
      specs: {
        images: [ { use: 'Business API image', size: null, ratio: null, maxFile: '5 MB', formats: 'JPG, PNG', note: 'Business API limit (Twilio/AWS docs).' } ],
        gif: null,
        video: [ { use: 'Business API video', ratio: null, size: null, length: null, maxFile: '16 MB', formats: 'MP4, 3GP', note: 'Consumer app files up to 2 GB (2022 report).' } ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'API media caption 1024; Channels caption limit unconfirmed.' },
        hashtags: 'Not used.',
        links: 'Links allowed with preview.'
      },
      sources: [ { title: 'AWS: WhatsApp supported media', url: 'https://docs.aws.amazon.com/social-messaging/latest/userguide/supported-media-types.html', date: '2026' } ]
    },
    {
      name: 'Discord',
      summary: 'Community announcements in servers; short text, embeds and images.',
      reach: [ { format: 'Announcement post with embed', why: 'Delivered to server members; followable announcement channels.', evidence: 'No dated reach study found.', source: 'https://support.discord.com/hc/en-us/articles/33694251638295', sourceDate: '2026' } ],
      tips: ['Free uploads now 20 MB (Aug 2026); keep media under it.', 'Use webhooks for scheduled posts.'],
      specs: {
        images: [ { use: 'Attachment', size: null, ratio: null, maxFile: '20 MB free', formats: 'JPG, PNG, GIF, WEBP', note: '50 MB Nitro Basic, 500 MB Nitro.' } ],
        gif: { supported: true, maxFile: '20 MB free', note: 'Same as file limit.' },
        video: [ { use: 'Attachment', ratio: null, size: null, length: null, maxFile: '20 MB free', formats: 'MP4, MOV, WEBM', note: '' } ],
        carousel: { maxItems: 10, note: '10 attachments per message (widely cited; unconfirmed).' },
        text: { post: 2000, comment: 2000, title: null, altText: null, note: '4000 with Nitro.' },
        hashtags: 'Not used.',
        links: 'Embeds generated from Open Graph.'
      },
      sources: [ { title: 'Discord account caps', url: 'https://support.discord.com/hc/en-us/articles/33694251638295', date: '2026' }, { title: 'Dexerto: Discord raises free upload limit to 20MB', url: 'https://www.dexerto.com/entertainment/discord-raises-free-upload-limit-to-20mb-after-lowering-it-two-years-ago-3398251/', date: '2026-08' } ]
    },
    {
      name: 'Signal',
      summary: 'Private messaging and groups; share short text, images and links directly.',
      reach: [ { format: 'Direct or group message', why: 'No feed; delivery only.', evidence: 'No dated reach study found.', source: 'https://support.signal.org/', sourceDate: null } ],
      tips: ['Attachment limits unconfirmed; compress video.'],
      specs: { images: [], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Attachment limit (100 MB often cited) unconfirmed.' }, hashtags: 'Not used.', links: 'Link previews optional.' },
      sources: [ { title: 'Signal support', url: 'https://support.signal.org/', date: null } ]
    },
    {
      name: 'WeChat',
      summary: 'Official Account articles and Channels video; specs not confirmed here.',
      reach: [ { format: 'Official Account article', why: 'Delivered to followers; shared in chats and Moments.', evidence: 'No dated reach study found.', source: 'https://mp.weixin.qq.com/', sourceDate: null } ],
      tips: ['Verify cover and article specs in the Official Account editor.'],
      specs: { images: [], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Unconfirmed.', links: 'External links in articles restricted; unconfirmed.' },
      sources: [ { title: 'WeChat Official Accounts', url: 'https://mp.weixin.qq.com/', date: null } ]
    },
    {
      name: 'Google Chat',
      summary: 'Internal team spaces; short text with link previews via webhooks or apps.',
      reach: [ { format: 'Space message or card', why: 'Direct delivery to space members.', evidence: 'No dated reach study found.', source: 'https://developers.google.com/workspace/chat', sourceDate: null } ],
      tips: ['Use incoming webhooks for scheduled posts.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Link previews shown.' },
      sources: [ { title: 'Google Chat developer docs', url: 'https://developers.google.com/workspace/chat', date: null } ]
    },
    {
      name: 'LinkedIn Newsletter',
      summary: 'Article sent by email and notification to subscribers; title doubles as the email subject.',
      reach: [ { format: 'Newsletter article with cover', why: 'Subscribers get email and in-app notifications.', evidence: 'LinkedIn: article title becomes the email subject line. No dated reach study found.', source: 'https://www.linkedin.com/help/learning/answer/a517940', sourceDate: '2026' } ],
      tips: ['Write the title as an email subject.', 'Use a 1920 x 1080 cover; it crops to 16:9.', 'Promote each issue with a feed post.'],
      specs: {
        images: [
          { use: 'Article cover', size: '1920 x 1080', ratio: '16:9', maxFile: null, formats: 'JPG, PNG, WEBP', note: '8 MB max reported by third parties, unconfirmed.' },
          { use: 'Newsletter logo', size: '300 x 300', ratio: '1:1', maxFile: null, formats: 'JPG, PNG', note: '' }
        ],
        gif: null, video: [], carousel: null,
        text: { post: null, comment: 1250, title: null, altText: null, note: 'Title limit unconfirmed.' },
        hashtags: 'Not needed.',
        links: 'Links inside articles are normal.'
      },
      sources: [ { title: 'LinkedIn Newsletters best practices', url: 'https://www.linkedin.com/help/learning/answer/a517940', date: '2026' } ]
    },
    {
      name: 'Substack',
      summary: 'Email plus app feed; clear subject lines and a strong social preview image drive opens and shares.',
      reach: [ { format: 'Email post with social preview image', why: 'Delivered by email; Notes and recommendations add discovery.', evidence: 'No dated reach study found.', source: 'https://substack.com/', sourceDate: null } ],
      tips: ['Subject 30 to 50 characters, key words first.', 'Design GIFs so the first frame works alone (classic Outlook).', 'Keep inline images about 600 to 1200 px wide.'],
      specs: {
        images: [
          { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: null, formats: 'JPG, PNG', note: 'Third-party; unconfirmed official.' },
          { use: 'Email banner', size: '1100 x 220', ratio: '5:1', maxFile: null, formats: 'JPG, PNG', note: 'Third-party.' }
        ],
        gif: { supported: true, maxFile: null, note: 'Classic Outlook shows only the first frame.' },
        video: [], carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Subject/preheader limits unconfirmed; mobile shows roughly 33 to 50 subject characters.' },
        hashtags: 'Not used.',
        links: 'Links in email are normal; many links can affect deliverability (general guidance).'
      },
      sources: [ { title: 'Substack image size FAQ (third-party)', url: 'https://frequentlyaskedquestions.substack.com/p/substack-image-size-faq-the-definitive', date: '2025' }, { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'beehiiv',
      summary: 'Email newsletter platform; standard email rules apply.',
      reach: [ { format: 'Email with clear subject and preview text', why: 'Opens depend on subject and preheader.', evidence: 'Vendors suggest subjects around 30 to 50 characters; mobile truncates at about 33 to 50.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Images 600 to 700 px wide (1200 to 1400 for retina).', 'First GIF frame must work alone for classic Outlook.', 'Preheader adds context, not a repeat of the subject.'],
      specs: { images: [ { use: 'Inline email image', size: '600 to 700 px wide', ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'General email guidance; beehiiv-specific limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook 2007 to 2019 shows first frame only.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'Mailchimp',
      summary: 'Email campaigns; 600 px classic or 660 px new-builder templates, images under 1 MB.',
      reach: [ { format: 'Email with short subject and preheader', why: 'Opens driven by subject line and sender.', evidence: 'Vendors recommend 30 to 50 character subjects; mobile truncation about 33 to 50.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Use 1200 to 1320 px images displayed at 600 to 660 px.', 'Keep each image under 1 MB.', 'First GIF frame must carry the message.'],
      specs: { images: [ { use: 'Email image', size: '600 to 1200 px (classic) / 660 to 1320 px (new builder)', ratio: null, maxFile: '1 MB recommended', formats: 'JPG, PNG, GIF', note: 'Mailchimp help content.' } ], gif: { supported: true, maxFile: '1 MB recommended', note: 'Classic Outlook shows first frame.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Subject/preheader limits unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Mailchimp: image recommendations (Intuit help)', url: 'https://quickbooks.intuit.com/learn-support/en-us/help-article/custom-templates/image-recommendations-content-blocks/L4UWIxpu2_US_en_US', date: '2025' }, { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'Kit',
      summary: 'Creator email platform; standard email rules apply.',
      reach: [ { format: 'Plain, personal-style email', why: 'Opens depend on subject and sender.', evidence: 'General email guidance; no Kit-specific study found.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Images 600 to 700 px wide.', 'First GIF frame must work alone.'],
      specs: { images: [ { use: 'Inline email image', size: '600 to 700 px wide', ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'General guidance; Kit limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'Brevo',
      summary: 'Email and SMS marketing; standard email rules apply.',
      reach: [ { format: 'Email with short subject', why: 'Opens driven by subject and sender.', evidence: 'General email guidance; no Brevo-specific study found.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Images 600 to 700 px wide.', 'First GIF frame must work alone.'],
      specs: { images: [ { use: 'Inline email image', size: '600 to 700 px wide', ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'General guidance; Brevo limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'MailerLite',
      summary: 'Email newsletters; standard email rules apply.',
      reach: [ { format: 'Email with short subject', why: 'Opens driven by subject and sender.', evidence: 'General email guidance; no MailerLite-specific study found.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Images 600 to 700 px wide.', 'First GIF frame must work alone.'],
      specs: { images: [ { use: 'Inline email image', size: '600 to 700 px wide', ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'General guidance; MailerLite limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'Buttondown',
      summary: 'Markdown-first newsletters; text-led emails with few images.',
      reach: [ { format: 'Text-led email', why: 'Lightweight emails render consistently.', evidence: 'General email guidance; no Buttondown-specific study found.', source: 'https://twilio.com/en-us/blog/ideal-email-subject-length', sourceDate: '2025' } ],
      tips: ['Keep images 600 to 700 px wide.', 'Write a preheader that adds context.'],
      specs: { images: [ { use: 'Inline email image', size: '600 to 700 px wide', ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'General guidance; limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Normal in email.' },
      sources: [ { title: 'Litmus: animated GIFs in email', url: 'https://www.litmus.com/blog/a-guide-to-animated-gifs-in-email', date: '2025' } ]
    },
    {
      name: 'WordPress',
      summary: 'Owned site: the featured image becomes the social preview; set Open Graph tags to 1200 x 630.',
      reach: [ { format: 'Article with og:image', why: 'Shares on Facebook, LinkedIn and others pull the og:image.', evidence: 'Meta recommends 1200 x 630 at about 1.91:1, max 8 MB.', source: 'https://developers.facebook.com/docs/sharing/webmasters/images/', sourceDate: '2026' } ],
      tips: ['Set featured image at 1200 x 630 or crop-safe larger.', 'Write alt text for every image.'],
      specs: { images: [ { use: 'Social preview (og:image)', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Meta guidance.' } ], gif: { supported: true, maxFile: null, note: 'Host-dependent.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'No platform limits; SEO title length is a search guideline, not a limit.' }, hashtags: 'Not used.', links: 'Your own domain; no penalty.' },
      sources: [ { title: 'Meta sharing images guide', url: 'https://developers.facebook.com/docs/sharing/webmasters/images/', date: '2026' } ]
    },
    {
      name: 'Website',
      summary: 'Custom site via webhook: provide og:image 1200 x 630 and descriptive alt text.',
      reach: [ { format: 'Page with Open Graph tags', why: 'Controls how the link looks on every social platform.', evidence: 'Meta: 1200 x 630 recommended, min 600 x 315 for large preview.', source: 'https://developers.facebook.com/docs/sharing/webmasters/images/', sourceDate: '2026' } ],
      tips: ['Set og:title, og:description and og:image on every page.', 'Use the permalink the owner enters.'],
      specs: { images: [ { use: 'Social preview (og:image)', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: '' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'No platform limits.' }, hashtags: 'Not used.', links: 'Own domain.' },
      sources: [ { title: 'Meta sharing images guide', url: 'https://developers.facebook.com/docs/sharing/webmasters/images/', date: '2026' } ]
    },
    {
      name: 'Medium',
      summary: 'Publication and tag-driven distribution; a strong title, subtitle and lead image.',
      reach: [ { format: 'Tagged article in a publication', why: 'Tags and publications drive internal distribution.', evidence: 'No dated reach study found.', source: 'https://help.medium.com/', sourceDate: null } ],
      tips: ['Use up to the allowed topic tags (5 commonly cited, unconfirmed).', 'Set a canonical link if cross-posting.'],
      specs: { images: [ { use: 'Lead image', size: null, ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'Unconfirmed; 1200 x 630 cited by third parties for shared links.' } ], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Topic tags; count unconfirmed.', links: 'Normal; set canonical URL for cross-posts.' },
      sources: [ { title: 'Medium help', url: 'https://help.medium.com/', date: null } ]
    },
    {
      name: 'Ghost',
      summary: 'Self-hosted publishing and newsletter; feature image and email rules apply.',
      reach: [ { format: 'Post with feature image sent as email', why: 'Web plus email delivery to members.', evidence: 'No dated reach study found.', source: 'https://ghost.org/help/', sourceDate: null } ],
      tips: ['Set the social preview image to 1200 x 630.', 'Email images 600 to 700 px wide.'],
      specs: { images: [ { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: null, formats: 'JPG, PNG', note: 'Per Meta OG guidance; Ghost feature image size unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame in emails.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags for site structure.', links: 'Own domain.' },
      sources: [ { title: 'Ghost help', url: 'https://ghost.org/help/', date: null } ]
    },
    {
      name: 'Hashnode',
      summary: 'Developer blogging with tags; a 1600 x 840 cover and technical depth.',
      reach: [ { format: 'Tagged technical article', why: 'Tag feeds drive discovery.', evidence: 'No dated reach study found.', source: 'https://townhall.hashnode.com/how-to-create-cover-images-for-your-devblog-posts', sourceDate: null } ],
      tips: ['Use a canonical URL when cross-posting.', 'Cover 1600 x 840.'],
      specs: { images: [ { use: 'Cover', size: '1600 x 840', ratio: '1.9:1', maxFile: null, formats: 'JPG, PNG', note: 'Hashnode guidance; min 800 x 420.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; count unconfirmed.', links: 'Canonical URL supported.' },
      sources: [ { title: 'Hashnode: cover images', url: 'https://townhall.hashnode.com/how-to-create-cover-images-for-your-devblog-posts', date: null } ]
    },
    {
      name: 'DEV',
      summary: 'Developer community; tagged, practical articles with a 1000 x 420 cover.',
      reach: [ { format: 'Tagged tutorial article', why: 'Tags and reactions drive the feed.', evidence: 'No dated reach study found.', source: 'https://dev.to/smitterhane/what-size-should-a-cover-image-of-a-post-be-2n9b', sourceDate: null } ],
      tips: ['Use up to 4 tags (commonly cited, unconfirmed).', 'Set canonical_url when cross-posting.'],
      specs: { images: [ { use: 'Cover', size: '1000 x 420', ratio: '2.38:1', maxFile: null, formats: 'JPG, PNG', note: 'Editor help text as reported by users.' } ], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; 4 commonly cited, unconfirmed.', links: 'Canonical URL supported.' },
      sources: [ { title: 'DEV: cover image size discussion', url: 'https://dev.to/smitterhane/what-size-should-a-cover-image-of-a-post-be-2n9b', date: null } ]
    },
    {
      name: 'Webflow',
      summary: 'Owned site CMS; set Open Graph image per collection item.',
      reach: [ { format: 'CMS page with og:image', why: 'Controls social link previews.', evidence: 'Meta: 1200 x 630 recommended.', source: 'https://developers.facebook.com/docs/sharing/webmasters/images/', sourceDate: '2026' } ],
      tips: ['Bind og:image to a CMS field.'],
      specs: { images: [ { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Meta guidance; Webflow upload limits unconfirmed.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Own domain.' },
      sources: [ { title: 'Meta sharing images guide', url: 'https://developers.facebook.com/docs/sharing/webmasters/images/', date: '2026' } ]
    },
    {
      name: 'Wix',
      summary: 'Owned site and blog; set cover and social image.',
      reach: [ { format: 'Blog post with social image', why: 'Controls social link previews.', evidence: 'Meta: 1200 x 630 recommended.', source: 'https://developers.facebook.com/docs/sharing/webmasters/images/', sourceDate: '2026' } ],
      tips: ['Check Wix blog image guide for layout sizes.'],
      specs: { images: [ { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Meta guidance; Wix blog sizes not verified here.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Own domain.' },
      sources: [ { title: 'Wix blog recommended image sizes', url: 'https://support.wix.com/en/article/wix-blog-recommended-image-sizes', date: null } ]
    },
    {
      name: 'Squarespace',
      summary: 'Owned site and blog; set social sharing image.',
      reach: [ { format: 'Page with social image', why: 'Controls social link previews.', evidence: 'Meta: 1200 x 630 recommended.', source: 'https://developers.facebook.com/docs/sharing/webmasters/images/', sourceDate: '2026' } ],
      tips: ['Set a social sharing image per page.'],
      specs: { images: [ { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Meta guidance; Squarespace limits unconfirmed.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Own domain.' },
      sources: [ { title: 'Meta sharing images guide', url: 'https://developers.facebook.com/docs/sharing/webmasters/images/', date: '2026' } ]
    },
    {
      name: 'HubSpot',
      summary: 'CMS blog and marketing email; follow web OG and email image rules.',
      reach: [ { format: 'Blog post plus email', why: 'Owned channels; preview and subject drive clicks and opens.', evidence: 'General guidance; no HubSpot-specific study found.', source: 'https://knowledge.hubspot.com/social/image-size-requirements-for-social-posts', sourceDate: null } ],
      tips: ['Featured image 1200 x 630.', 'Email images 600 to 700 px wide.'],
      specs: { images: [ { use: 'Social preview', size: '1200 x 630', ratio: '1.91:1', maxFile: '8 MB', formats: 'JPG, PNG', note: 'Meta guidance.' } ], gif: { supported: true, maxFile: null, note: 'Classic Outlook shows first frame in email.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Own domain.' },
      sources: [ { title: 'HubSpot: image size requirements for social posts', url: 'https://knowledge.hubspot.com/social/image-size-requirements-for-social-posts', date: null } ]
    },
    {
      name: 'YouTube',
      summary: 'Shorts drive discovery and views; long-form views are up but watch time per view is down.',
      reach: [
        { format: 'Shorts (up to 3 min)', why: 'Shorts feed dominates discovery.', evidence: 'Metricool (about 800K videos): Shorts views up over 127%, long-form views up 76% YoY; long-form average view duration down 37%, Shorts down 67%.', source: 'https://metricool.com/press-release-youtube-study-2026/', sourceDate: '2026-07' },
        { format: 'Shorts feeding long-form', why: 'Channels posting about 5 Shorts a month get more long-form views.', evidence: 'Metricool: 8,789 views per long-form video, about 46% above the average.', source: 'https://metricool.com/press-release-youtube-study-2026/', sourceDate: '2026-07' },
        { format: 'New channel first uploads', why: 'Shorts get early traction faster.', evidence: 'vidIQ: typical first Short 1,362 views after 30 days vs 180 for first long-form.', source: 'https://vidiq.com/research/youtube-first-10-videos-study/', sourceDate: '2026-07' }
      ],
      tips: [
        'Use Shorts to feed long-form; link related video.',
        'Use 16:9 if a video must not be classified as a Short.',
        'Shorts over 1 min with a Content ID claim are blocked; check music.',
        'Upload thumbnails at 3840 x 2160 (16:9).'
      ],
      specs: {
        images: [
          { use: 'Video thumbnail', size: '3840 x 2160 (min width 640)', ratio: '16:9', maxFile: '2 MB mobile / 50 MB desktop', formats: 'JPG, PNG', note: '' },
          { use: 'Shorts thumbnail', size: '2160 x 3840 (min height 640)', ratio: '9:16', maxFile: '2 MB mobile / 50 MB desktop', formats: 'JPG, PNG', note: '' }
        ],
        gif: null,
        video: [
          { use: 'Short', ratio: 'Square or vertical (9:16)', size: '1080 x 1920', length: 'up to 3 min', maxFile: null, formats: 'MP4, MOV', note: '' },
          { use: 'Long-form', ratio: '16:9', size: null, length: '15 min default; up to 12 h verified', maxFile: '256 GB', formats: 'MP4, MOV', note: '' }
        ],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Title 100 and description 5000 widely cited; not confirmed this session.' },
        hashtags: '2 to 3 in description; first 3 show above title (unconfirmed).',
        links: 'Description links fine; Shorts links not clickable except related video.'
      },
      sources: [
        { title: 'YouTube Help: three-minute Shorts', url: 'https://support.google.com/youtube/answer/15424877?hl=en', date: '2026' },
        { title: 'YouTube Help: thumbnails', url: 'https://support.google.com/youtube/answer/72431?hl=en', date: '2026' },
        { title: 'YouTube Help: upload longer videos', url: 'https://support.google.com/youtube/answer/71673?hl=en', date: '2026' },
        { title: 'Metricool 2026 YouTube study', url: 'https://metricool.com/press-release-youtube-study-2026/', date: '2026-07' },
        { title: 'vidIQ: first 10 videos study', url: 'https://vidiq.com/research/youtube-first-10-videos-study/', date: '2026-07' }
      ]
    },
    {
      name: 'Vimeo',
      summary: 'Video hosting for embeds and portfolios; limits depend on plan.',
      reach: [ { format: 'Hosted video embedded on owned site', why: 'Distribution is via embeds and links, not a feed.', evidence: 'No dated reach study found.', source: 'https://help.vimeo.com/', sourceDate: null } ],
      tips: ['Upload the highest quality master; Vimeo transcodes.'],
      specs: { images: [ { use: 'Thumbnail', size: null, ratio: '16:9', maxFile: null, formats: 'JPG, PNG', note: 'Unconfirmed.' } ], gif: null, video: [ { use: 'Upload', ratio: null, size: null, length: null, maxFile: null, formats: 'MP4, MOV', note: 'Plan-dependent; unconfirmed.' } ], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags optional.', links: 'Not applicable.' },
      sources: [ { title: 'Vimeo help', url: 'https://help.vimeo.com/', date: null } ]
    },
    {
      name: 'Twitch',
      summary: 'Live streaming; schedule announcements and clips promote streams.',
      reach: [ { format: 'Scheduled live stream with clips', why: 'Live is the core format; clips spread off-platform.', evidence: 'No dated reach study found.', source: 'https://help.twitch.tv/', sourceDate: null } ],
      tips: ['Publish a stream schedule and post clips to short-video platforms.'],
      specs: { images: [], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Stream tags; count unconfirmed.', links: 'Panels and chat links.' },
      sources: [ { title: 'Twitch help', url: 'https://help.twitch.tv/', date: null } ]
    },
    {
      name: 'Spotify',
      summary: 'Podcast distribution; square cover art and clear episode titles.',
      reach: [ { format: 'Podcast episode (audio or video)', why: 'Discovery via search and recommendations.', evidence: 'No dated reach study found.', source: 'https://podcasters.spotify.com/', sourceDate: null } ],
      tips: ['Reuse 3000 x 3000 square art (Apple spec) for consistency.'],
      specs: { images: [ { use: 'Cover art', size: null, ratio: '1:1', maxFile: null, formats: 'JPG, PNG', note: 'Spotify size limits unconfirmed.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Show notes links.' },
      sources: [ { title: 'Spotify for Podcasters', url: 'https://podcasters.spotify.com/', date: null } ]
    },
    {
      name: 'Apple Podcasts',
      summary: 'Podcast directory; square 3000 x 3000 art and descriptive titles.',
      reach: [ { format: 'Episode with episode art', why: 'Art and titles show in browse and search.', evidence: 'No dated reach study found.', source: 'https://podcasters.apple.com/support/5514-show-cover-template', sourceDate: null } ],
      tips: ['Host art on a server that allows HTTP HEAD requests.'],
      specs: { images: [ { use: 'Show cover', size: '3000 x 3000 (min 1400 x 1400)', ratio: '1:1', maxFile: null, formats: 'JPG, PNG', note: 'RGB, 72 dpi.' } ], gif: null, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Not used.', links: 'Show notes links.' },
      sources: [ { title: 'Apple: show cover template', url: 'https://podcasters.apple.com/support/5514-show-cover-template', date: '2026' }, { title: 'Apple: podcast artwork', url: 'https://itunespartner.apple.com/podcasts/articles/artwork-3066', date: null } ]
    },
    {
      name: 'Patreon',
      summary: 'Member posts; previews and public posts drive conversions.',
      reach: [ { format: 'Public preview post', why: 'Public posts are the discovery surface; member posts deliver value.', evidence: 'No dated reach study found.', source: 'https://support.patreon.com/', sourceDate: null } ],
      tips: ['Use 1200 x 630 images for posts shared off-platform (OG guidance).'],
      specs: { images: [], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; count unconfirmed.', links: 'Normal.' },
      sources: [ { title: 'Patreon support', url: 'https://support.patreon.com/', date: null } ]
    },
    {
      name: 'Behance',
      summary: 'Portfolio projects; a strong cover image decides clicks in the gallery.',
      reach: [ { format: 'Project with strong cover', why: 'Covers display at 202 x 158 in galleries.', evidence: 'No dated reach study found.', source: 'https://help.behance.net/hc/en-us/articles/204483484-Guide-Project-Cover-Image', sourceDate: null } ],
      tips: ['Keep cover simple; it displays small.'],
      specs: { images: [ { use: 'Project cover', size: '808 x 632 (min)', ratio: '4:3 approx', maxFile: null, formats: 'JPG, PNG, GIF', note: 'Displayed at 202 x 158.' } ], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; count unconfirmed.', links: 'Normal.' },
      sources: [ { title: 'Behance: project cover image', url: 'https://help.behance.net/hc/en-us/articles/204483484-Guide-Project-Cover-Image', date: null } ]
    },
    {
      name: 'Dribbble',
      summary: 'Design shots at 4:3; polished single visuals or short animations.',
      reach: [ { format: 'Shot (4:3 image or short video)', why: 'Popular and tag feeds drive views.', evidence: 'No dated reach study found.', source: 'https://help.dribbble.com/en/articles/11062601-creating-dribbble-shots', sourceDate: null } ],
      tips: ['Use 1600 x 1200.', 'Video limits conflict; keep clips short and small.'],
      specs: { images: [ { use: 'Shot', size: '1600 x 1200', ratio: '4:3', maxFile: '8 MB', formats: 'JPG, PNG, GIF', note: 'Third-party 2026 guide.' } ], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [ { use: 'Shot', ratio: '4:3', size: '1600 x 1200', length: null, maxFile: null, formats: 'MP4, MOV', note: '20 MB or 30 MB per conflicting sources; 24 s cap from 2018, unconfirmed now.' } ], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; count unconfirmed.', links: 'Unconfirmed.' },
      sources: [ { title: 'Dribbble: creating shots', url: 'https://help.dribbble.com/en/articles/11062601-creating-dribbble-shots', date: null } ]
    },
    {
      name: 'Flickr',
      summary: 'Photography community; high-resolution photos in groups and with tags.',
      reach: [ { format: 'Tagged photo shared to groups', why: 'Groups and tags drive Explore and search.', evidence: 'No dated reach study found.', source: 'https://www.flickrhelp.com/', sourceDate: null } ],
      tips: ['Add relevant tags and group shares.'],
      specs: { images: [ { use: 'Photo', size: null, ratio: null, maxFile: null, formats: 'JPG, PNG, GIF', note: 'Size limits unconfirmed.' } ], gif: { supported: true, maxFile: null, note: 'Unconfirmed.' }, video: [], carousel: null, text: { post: null, comment: null, title: null, altText: null, note: 'Unconfirmed.' }, hashtags: 'Tags; count unconfirmed.', links: 'Unconfirmed.' },
      sources: [ { title: 'Flickr help', url: 'https://www.flickrhelp.com/', date: null } ]
    },
    {
      name: 'lemlist',
      summary: 'Cold email and multichannel outreach sequences; reach depends on deliverability and personalisation rather than a feed.',
      reach: [ { format: 'Short, personalised plain-text email', why: 'Outreach lands in the primary inbox more often when it reads like a personal email.', evidence: 'No dated platform study found; follow lemlist deliverability guidance.', source: 'https://help.lemlist.com/', sourceDate: null } ],
      tips: ['Warm up a new sending domain before a campaign.', 'Keep links and images to a minimum in the first email.', 'Personalise the first line and the call to action for each lead.'],
      specs: {
        images: [],
        gif: { supported: null, maxFile: null, note: 'Unconfirmed.' },
        video: [],
        carousel: null,
        text: { post: null, comment: null, title: null, altText: null, note: 'Email subject and body limits unconfirmed.' },
        hashtags: 'Not used.',
        links: 'Few links per email; heavy link use can hurt deliverability (unconfirmed for lemlist specifically).'
      },
      sources: [ { title: 'lemlist help center', url: 'https://help.lemlist.com/', date: null } ]
    }
  ]
};
