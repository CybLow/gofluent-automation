export const SELECTORS = {
  LOGIN: {
    DOMAIN_INPUT: '#outlined-size-normal',
    SUBMIT_BUTTON: 'button[type="submit"]',
  },

  MICROSOFT: {
    USERNAME_INPUT: '#i0116',
    PASSWORD_INPUT: '#i0118',
    SUBMIT_BUTTON: '#idSIButton9',
    STAY_SIGNED_IN: "xpath=//*[contains(text(), 'Stay signed in?')]",
    STAY_SIGNED_IN_FR: "xpath=//*[contains(text(), 'Rester connecté')]",
    FEEDBACK_ERROR: "xpath=//*[contains(text(), 'Your account or password is incorrect.')]",
    PICK_ACCOUNT_OTHER: '#otherTile',
  },

  DASHBOARD: {
    LOGO: '.header__logo',
    HEADER: "[class*='header']",
    MODAL_SKIP: "xpath=//span[contains(@class, 'skipButton')]",
    MODAL_BACKDROP: '.MuiBackdrop-root',
  },

  PROFILE: {
    LANGUAGE_ITEM: "xpath=//img[starts-with(@alt, 'flag')]/ancestor::div[contains(@class, 'profile-item_item')]",
    LANGUAGE_VALUE: "div[class*='profile-item_content']",
    LANGUAGE_FLAG: "img[alt^='flag']",
    LANGUAGE_COMBOBOX: '.MuiAutocomplete-input',
    LANGUAGE_OPEN_BUTTON: '.MuiAutocomplete-popupIndicator',
    LANGUAGE_OPTION: "[role='option']",
  },

  TRAINING: {
    CONTAINER: '.training-page',
    PAGINATION: '.pagination',
    PAGINATION_ITEM: '.pagination-item',
    BLOCK: '.training-card-block',
    BLOCK_DATE: '.training-card-block__date',
    BLOCK_CARD: '.training-card',
    BLOCK_CARD_LINK: '.training-card__link',
    BLOCK_CARD_FLAG: "img[alt^='flag']",
  },

  RESOURCES: {
    ACTIVITIES_LIST: '.browse-all-activities__list',
    SCROLL_INNER: '.browse-all-activities .rcs-inner-container',
  },

  NAV: {
    TABS: '.tabs',
    LEARNING_TAB: '#learn',
    QUIZ_TAB: '#practice',
  },

  LEARNING: {
    SIDEBAR_ITEM: '.HowtoNavigationSidebar__list > .HowtoNavigationSidebar__item',
    SIDEBAR: '.HowtoNavigationSidebar',
    SECTION: '.section',
  },

  QUIZ: {
    CONTAINER: '#quiz',
    QUIZ_CONTAINER_NEW: "[class*='quiz-new_quizContainer']",
    START: '#quiz-button-start, #quiz-button-resume',
    QUESTION: "[class*='quiz-common-question_container']",
    INSERTABLE_PAGE: "[class*='quiz-insertable-page_container']",
    SUBMIT: '#quiz-button-submit',
    NEXT: '#quiz-button-next',
    RETAKE: "xpath=//button[contains(@class, 'quiz-button_outlined')]",
    SCORE: "[class*='quiz-score_score']",
    END_PAGE: "[class*='quiz-end-page_container']",
    SOURCE_CONTAINER: '#source-container',
    SOURCE_OPTION: "#source-container [role='button']",
    RECEIVER: "[id^='receiver-']",
    RADIO_OPTION: "label[role='radio']",
    CORRECT_ANSWER_TITLE: "[class*='quiz-explanation_title']",
    CORRECT_ANSWER_LIST: "li[class*='quiz-explanation_answer']",
    INSTRUCTIONS: "[class*='quiz-common-question_instructions']",
    STEM: "[class*='quiz-common-question_stem'], [class*='quiz-text-inputs_stem'], [class*='quiz-scrambled-letters_stem']",
  },
} as const;
