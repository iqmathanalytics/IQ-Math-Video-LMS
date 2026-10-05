export type Topic = "AI" | "Web" | "Cloud" | "Data" | "DevOps" | "Career";

export type PublicCourse = {
  slug: string;
  title: string;
  topic: Topic;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  language: string;
  rating: string;
  blurb: string;
  outcomes: string[];
  youtubeId?: string;
  creatorName: string;
  channelName: string;
  channelUrl: string;
  sourceUrl: string;
};

export const TOPICS: Array<Topic | "All"> = ["All", "AI", "Web", "Cloud", "Data", "DevOps", "Career"];

export const COURSES: PublicCourse[] = [
  {
    slug: "web-foundations",
    title: "Web foundations for product teams",
    topic: "Web",
    level: "Beginner",
    duration: "Self-paced",
    language: "English",
    rating: "4.7",
    blurb: "A curated path through HTML, CSS and JavaScript lessons. IQNex keeps the creator on screen and the source link one click away.",
    outcomes: ["Lay out a page that works on a phone", "Read a component the way an engineer does", "Pair a lesson with a small build task"],
    creatorName: "Traversy Media",
    channelName: "Traversy Media",
    channelUrl: "https://www.youtube.com/@TraversyMedia",
    sourceUrl: "https://www.youtube.com/@TraversyMedia",
  },
  {
    slug: "cloud-operating-picture",
    title: "How a cloud platform is actually operated",
    topic: "Cloud",
    level: "Intermediate",
    duration: "Self-paced",
    language: "English",
    rating: "4.6",
    blurb: "Architecture, identity and cost, taught from the operator's side. Lessons stay on the publisher's channel.",
    outcomes: ["Name the moving parts of a cloud app", "Spot an identity mistake", "Talk about cost with numbers"],
    creatorName: "Amazon Web Services",
    channelName: "AWS",
    channelUrl: "https://www.youtube.com/@amazonwebservices",
    sourceUrl: "https://www.youtube.com/@amazonwebservices",
  },
  {
    slug: "data-stories",
    title: "Data work that starts with a question",
    topic: "Data",
    level: "Beginner",
    duration: "Self-paced",
    language: "English",
    rating: "4.7",
    blurb: "A path for analysts who need to clean a table, chart the answer, and explain it without hiding the uncertainty.",
    outcomes: ["Frame a question before opening a tool", "Clean a small dataset", "Present one chart you can defend"],
    creatorName: "freeCodeCamp.org",
    channelName: "freeCodeCamp.org",
    channelUrl: "https://www.youtube.com/@freecodecamp",
    sourceUrl: "https://www.youtube.com/@freecodecamp",
  },
  {
    slug: "devops-release-habit",
    title: "A release habit for small engineering teams",
    topic: "DevOps",
    level: "Intermediate",
    duration: "Self-paced",
    language: "English",
    rating: "4.6",
    blurb: "Build, test and ship as a weekly habit. Short lessons, a checklist after each one, and a source link on every card.",
    outcomes: ["Write a pipeline you can explain", "Catch a broken build before users do", "Keep a changelog that humans read"],
    creatorName: "Fireship",
    channelName: "Fireship",
    channelUrl: "https://www.youtube.com/@Fireship",
    sourceUrl: "https://www.youtube.com/@Fireship",
  },
];

export const PATHS = [
  {
    slug: "ai-builder",
    title: "AI builder",
    steps: ["Read a small model diagram", "Python practice", "A small model you can show"],
  },
  {
    slug: "web-product",
    title: "Web product",
    steps: ["Page foundations", "A component you ship", "Review with a peer"],
  },
  {
    slug: "cloud-operator",
    title: "Cloud operator",
    steps: ["The operating picture", "Identity and access", "A cost note for your team"],
  },
];

export const FAQS = [
  {
    q: "Where do I find my courses?",
    a: "Sign in with your learner account. Courses you are enrolled in appear under My learning. This page describes the school; it does not publish the live catalogue.",
  },
  {
    q: "Where do the lessons play?",
    a: "Lessons open inside IQNex. YouTube lessons are embedded there, with the creator named on the lesson. IQNex does not download or re-upload those videos.",
  },
  {
    q: "How do paid courses work?",
    a: "A paid course opens Razorpay checkout. You can pay with UPI, a card, netbanking, or a wallet. The course is added to your account after the payment is verified.",
  },
  {
    q: "When is a certificate issued?",
    a: "After you submit the course assessment. Download it from the certificate page in your account.",
  },
  {
    q: "How do I reach the school?",
    a: "Email contact@iqmath.in or WhatsApp +91 93609 60219. Include the course name if you are asking about a lesson.",
  },
];

export const NAV: { label: string; path: string; group: string }[] = [];
