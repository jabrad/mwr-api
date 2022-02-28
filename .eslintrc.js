module.exports = {
  root: true,
  env : {
    node  : true,
    es2017: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    /* Block style */
    'curly': [
      'error',
      'multi-or-nest',
      'consistent',
    ],
    'brace-style'                     : 'off',
    '@typescript-eslint/brace-style'  : ['error', 'stroustrup'],
    'nonblock-statement-body-position': ['error', 'below'],

    /* Spacing */
    'indent'                   : 'off',
    '@typescript-eslint/indent': ['error', 2],
    'no-multi-spaces'          : ['error', {
      ignoreEOLComments: true,
      exceptions       : {
        'Property'          : true,
        'VariableDeclarator': true,
        'ImportDeclaration' : true,
      },
    }],
    'array-bracket-spacing'               : 'error',
    'comma-spacing'                       : 'off',
    '@typescript-eslint/comma-spacing'    : 'error',
    'func-call-spacing'                   : 'off',
    '@typescript-eslint/func-call-spacing': 'error',
    'key-spacing'                         : ['warn', { align: 'colon' }],
    'keyword-spacing'                     : 'off',
    '@typescript-eslint/keyword-spacing'  : 'error',
    'object-curly-spacing'                : ['error', 'always'],
    'space-before-blocks'                 : 'error',
    'space-before-function-paren'         : ['error', {
      named: 'never',
    }],
    'space-in-parens'              : 'error',
    'space-infix-ops'              : 'error',
    'space-unary-ops'              : 'error',
    'switch-colon-spacing'         : 'error',
    'template-tag-spacing'         : 'error',
    'arrow-spacing'                : 'error',
    'rest-spread-spacing'          : 'error',
    'template-curly-spacing'       : 'error',
    'no-trailing-spaces'           : 'error',
    'no-whitespace-before-property': 'error',

    /* Other style related rules */
    'arrow-body-style': 'error',
    'arrow-parens'    : ['error', 'as-needed', {
      requireForBlockBody: true,
    }],
    'comma-dangle': ['warn', 'always-multiline'],
    'comma-style' : 'error',
    'one-var'     : ['error', 'never'],
    'max-len'     : ['warn', 90, {
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals  : true,
      /* Ignore lines ending with a string */
      ignorePattern         : /['"`][)\]},;]*$/.source,
    }],
    'newline-per-chained-call': ['error', { ignoreChainWithDepth: 3 }],
    'linebreak-style'         : ['error', 'unix'],
    'eol-last'                : 'error',
    'semi'                    : 'off',
    '@typescript-eslint/semi' : 'error',

    '@typescript-eslint/no-non-null-assertion': 'warn',

    /* Allow requires in the root directory */
    '@typescript-eslint/no-var-requires': 'off',

    /* Allow "// @ts-<directive>" comments in .js files */
    '@typescript-eslint/ban-ts-comment': 'off',
  },
  overrides: [
    /* overrides for .ts files */
    {
      files: [
        "*.ts",
      ],
      rules: {
        '@typescript-eslint/no-var-requires': 'error',
        '@typescript-eslint/ban-ts-comment' : 'error',

        /* Already handled by tsc as needed */
        'no-fallthrough'                   : 'off',
        '@typescript-eslint/no-unused-vars': 'off',

      },
    },
    {
      files: [
        "*.js",
      ],
      rules: {
        /* non-applicable for .js files */
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    /* relax rules for test files, and extend their environment */
    {
      files: [
        "test/**",
      ],
      env: {
        mocha: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any'               : 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  ],
};
