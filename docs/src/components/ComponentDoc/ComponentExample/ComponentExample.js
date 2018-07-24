import * as Babel from '@babel/standalone'
import copyToClipboard from 'copy-to-clipboard'
import { html } from 'js-beautify'
import _ from 'lodash'
import PropTypes from 'prop-types'
import React, { createElement, isValidElement, PureComponent } from 'react'
import { withRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { Divider, Grid, Menu, Segment, Visibility } from 'semantic-ui-react'

import {
  exampleContext,
  examplePathToHash,
  getFormattedHash,
  repoURL,
  scrollToAnchor,
} from 'docs/src/utils'
import Editor, { EDITOR_BACKGROUND_COLOR } from 'docs/src/components/Editor/Editor'
import ComponentControls from '../ComponentControls'
import ComponentExampleTitle from './ComponentExampleTitle'
import CarbonAdNative from '../../CarbonAd/CarbonAdNative'

const babelConfig = {
  presets: [
    [
      'env',
      {
        targets: {
          browsers: ['last 4 versions', 'not dead'],
        },
      },
    ],
    'react',
    ['stage-1', { decoratorsLegacy: true }],
  ],
}

const childrenStyle = {
  paddingTop: 0,
  maxWidth: '50rem',
}

const errorStyle = {
  fontSize: '0.9rem',
  fontFamily: 'monospace',
  whiteSpace: 'pre',
}

const htmlAreaStyle = {
  padding: '1rem',
  filter: 'grayscale()',
}
const htmlDividerStyle = {
  opacity: 0.5,
}

const renderedExampleStyle = {
  padding: '2rem',
}

/**
 * Renders a `component` and the raw `code` that produced it.
 * Allows toggling the the raw `code` code block.
 */
class ComponentExample extends PureComponent {
  state = {}

  static contextTypes = {
    onPassed: PropTypes.func,
  }

  static propTypes = {
    children: PropTypes.node,
    description: PropTypes.node,
    examplePath: PropTypes.string.isRequired,
    history: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    suiVersion: PropTypes.string,
    title: PropTypes.node,
  }

  componentWillMount() {
    const { examplePath } = this.props
    this.anchorName = examplePathToHash(examplePath)

    const exampleElement = this.renderOriginalExample()

    this.setState({
      exampleElement,
      handleMouseLeave: this.handleMouseLeave,
      handleMouseMove: this.handleMouseMove,
      showCode: this.isActiveHash(),
      sourceCode: this.getOriginalSourceCode(),
      markup: renderToStaticMarkup(exampleElement),
    })
  }

  componentWillReceiveProps(nextProps) {
    // deactivate examples when switching from one to the next
    if (
      this.isActiveHash() &&
      this.isActiveState() &&
      this.props.location.hash !== nextProps.location.hash
    ) {
      this.clearActiveState()
    }
  }

  clearActiveState = () => {
    this.setState({
      showCode: false,
      showHTML: false,
    })
  }

  isActiveState = () => {
    const { showCode, showHTML } = this.state

    return showCode || showHTML
  }

  isActiveHash = () => this.anchorName === getFormattedHash(this.props.location.hash)

  updateHash = () => {
    if (this.isActiveState()) this.setHashAndScroll()
  }

  setHashAndScroll = () => {
    const { history, location } = this.props

    history.replace(`${location.pathname}#${this.anchorName}`)
    scrollToAnchor()
  }

  removeHash = () => {
    const { history, location } = this.props

    history.replace(location.pathname)

    this.clearActiveState()
  }

  handleDirectLinkClick = () => {
    this.setHashAndScroll()
    copyToClipboard(window.location.href)
  }

  handleMouseLeave = () => {
    this.setState({
      isHovering: false,
      handleMouseLeave: null,
      handleMouseMove: this.handleMouseMove,
    })
  }

  handleMouseMove = () => {
    this.setState({
      isHovering: true,
      handleMouseLeave: this.handleMouseLeave,
      handleMouseMove: null,
    })
  }

  handleShowCodeClick = (e) => {
    e.preventDefault()

    const { showCode } = this.state

    this.setState({ showCode: !showCode }, this.updateHash)
  }

  handleShowHTMLClick = (e) => {
    e.preventDefault()

    const { showHTML } = this.state

    this.setState({ showHTML: !showHTML }, this.updateHash)
  }

  handlePass = () => {
    const { title } = this.props

    if (title) _.invoke(this.context, 'onPassed', null, this.props)
  }

  copyJSX = () => {
    copyToClipboard(this.state.sourceCode)
    this.setState({ copiedCode: true })
    setTimeout(() => this.setState({ copiedCode: false }), 1000)
  }

  resetJSX = () => {
    // eslint-disable-next-line no-alert
    if (this.hasOriginalCodeChanged() && confirm('Lose your changes?')) {
      this.setState({ sourceCode: this.getOriginalSourceCode() })
      this.renderSourceCode()
    }
  }

  hasOriginalCodeChanged = () => {
    const { sourceCode } = this.state
    const original = this.getOriginalSourceCode()

    return sourceCode !== original
  }

  getOriginalSourceCode = () => {
    const { examplePath } = this.props

    if (!this.sourceCode) this.sourceCode = require(`!raw-loader!../../../examples/${examplePath}`)

    return this.sourceCode
  }

  getKebabExamplePath = () => {
    if (!this.kebabExamplePath) this.kebabExamplePath = _.kebabCase(this.props.examplePath)

    return this.kebabExamplePath
  }

  renderError = _.debounce((error) => {
    this.setState({ error })
  }, 800)

  renderOriginalExample = () => {
    const { examplePath } = this.props
    return createElement(exampleContext(`./${examplePath}.js`).default)
  }

  renderSourceCode = _.debounce(() => {
    const { examplePath } = this.props
    const { sourceCode } = this.state
    // Heads Up!
    //
    // These are used in the code editor scope when rewriting imports to const statements
    // We use require() to preserve variable names
    // Webpack rewrites import names
    /* eslint-disable no-unused-vars */
    const FAKER = require('faker')
    const LODASH = require('lodash')
    const REACT = require('react')
    const SEMANTIC_UI_REACT = require('semantic-ui-react')
    let WIREFRAME
    let COMMON
    /* eslint-enable no-unused-vars */

    // Should use an AST transform here... oh well :/
    // Rewrite the example file into an IIFE that returns a component
    // which can be rendered in this ComponentExample's render() method

    // rewrite imports to const statements against the UPPERCASE module names
    const imports = _
      .get(/(^[\s\S])*import[\s\S]*from[\s\S]*['"]\n/.exec(sourceCode), '[0]', '')
      .replace(/[\s\n]+/g, ' ') // normalize spaces and make one line
      .replace(/ import/g, '\nimport') // one import per line
      .split('\n') // split lines
      .filter(Boolean) // remove empty lines
      .map((l) => {
        // rewrite imports to const statements
        const [defaultImport, destructuredImports, _module] = _.tail(
          /import\s+([\w]+)?(?:\s*,\s*)?({[\s\w,]+})?\s+from\s+['"](?:.*\/)?([\w\-_]+)['"]/.exec(l),
        )

        const module = _.snakeCase(_module).toUpperCase()

        if (module === 'COMMON') {
          const componentPath = examplePath
            .split(__PATH_SEP__)
            .splice(0, 2)
            .join(__PATH_SEP__)
          COMMON = require(`docs/src/examples/${componentPath}/common`)
        } else if (module === 'WIREFRAME') {
          WIREFRAME = require('docs/src/examples/behaviors/Visibility/Wireframe').default
        }

        const constStatements = []
        if (defaultImport) constStatements.push(`const ${defaultImport} = ${module}`)
        if (destructuredImports) constStatements.push(`const ${destructuredImports} = ${module}`)
        constStatements.push('\n')

        return constStatements.join('\n')
      })
      .join('\n')

    // capture the default export so we can return it from the IIFE
    const defaultExport = _.get(
      /export\s+default\s+(?:class|function)?(?:\s+)?(\w+)/.exec(sourceCode),
      '[1]',
    )

    const body = _
      .get(/(export\sdefault\sclass|const|class\s\S*\sextends)[\s\S]*/.exec(sourceCode), '[0]', '')
      .replace(/export\s+default\s+(?!class|function)\w+([\s\n]+)?/, '') // remove `export default Foo` statements
      .replace(/export\s+default\s+/, '') // remove `export default ...`

    const IIFE = `(function() {\n${imports}${body}return ${defaultExport}\n}())`

    try {
      const { code } = Babel.transform(IIFE, babelConfig)
      const Example = eval(code) // eslint-disable-line no-eval
      const exampleElement = _.isFunction(Example) ? <Example /> : Example

      if (!isValidElement(exampleElement)) {
        this.renderError(
          `Default export is not a valid element. Type:${{}.toString.call(exampleElement)}`,
        )
      } else {
        // immediately render a null error
        // but also ensure the last debounced error call is a null error
        const error = null
        this.renderError(error)
        this.setState({
          error,
          exampleElement,
          markup: renderToStaticMarkup(exampleElement),
        })
      }
    } catch (err) {
      this.renderError(err.message)
    }
  }, 100)

  handleChangeCode = (sourceCode) => {
    this.setState({ sourceCode }, this.renderSourceCode)
  }

  renderJSXControls = () => {
    const { examplePath } = this.props
    const { copiedCode } = this.state

    // get component name from file path:
    // elements/Button/Types/ButtonButtonExample
    const pathParts = examplePath.split(__PATH_SEP__)
    const filename = pathParts[pathParts.length - 1]

    const ghEditHref = [
      `${repoURL}/edit/master/docs/src/examples/${examplePath}.js`,
      `?message=docs(${filename}): your description`,
    ].join('')

    const codeEditorStyle = {
      position: 'absolute',
      margin: 0,
      top: '2px',
      right: '0.5rem',
      zIndex: 1,
    }

    return (
      <Menu size='small' secondary inverted text style={codeEditorStyle}>
        <Menu.Item
          style={
            this.hasOriginalCodeChanged() ? undefined : { opacity: 0.5, pointerEvents: 'none' }
          }
          icon='refresh'
          content='Reset'
          onClick={this.resetJSX}
        />
        <Menu.Item
          active={copiedCode} // to show the color
          icon={copiedCode ? { color: 'green', name: 'check' } : 'copy'}
          content='Copy'
          onClick={this.copyJSX}
        />
        <Menu.Item
          style={{ border: 'none' }}
          icon='github'
          content='Edit'
          href={ghEditHref}
          target='_blank'
        />
      </Menu>
    )
  }

  renderJSX = () => {
    const { error, showCode, sourceCode } = this.state
    if (!showCode) return

    const style = {
      position: 'relative',
    }

    return (
      <div style={style}>
        {this.renderJSXControls()}
        <Editor
          id={`${this.getKebabExamplePath()}-jsx`}
          value={sourceCode}
          onChange={this.handleChangeCode}
        />
        {error && (
          <Segment color='red' basic secondary inverted style={errorStyle}>
            {error}
          </Segment>
        )}
      </div>
    )
  }

  renderHTML = () => {
    const { showHTML, markup } = this.state
    if (!showHTML) return

    // add new lines between almost all adjacent elements
    // moves inline elements to their own line
    const preFormattedHTML = markup.replace(/><(?!\/i|\/label|\/span|option)/g, '>\n<')

    const beautifiedHTML = html(preFormattedHTML, {
      indent_size: 2,
      indent_char: ' ',
      wrap_attributes: 'auto',
      wrap_attributes_indent_size: 2,
      end_with_newline: false,
    })

    return (
      <div style={htmlAreaStyle}>
        <Divider inverted horizontal style={htmlDividerStyle}>
          HTML
        </Divider>
        <Editor
          id={`${this.getKebabExamplePath()}-html`}
          mode='html'
          value={beautifiedHTML}
          readOnly
        />
      </div>
    )
  }

  render() {
    const { children, description, examplePath, suiVersion, title } = this.props
    const {
      handleMouseLeave,
      handleMouseMove,
      exampleElement,
      isHovering,
      showCode,
      showHTML,
    } = this.state

    const isActive = this.isActiveHash() || this.isActiveState()

    const exampleStyle = {
      position: 'relative',
      background: '#fff',
      boxShadow: '0 1px 2px #ccc',
      ...(isActive
        ? {
          boxShadow: '0 8px 32px #aaa',
        }
        : isHovering && {
          boxShadow: '0 2px 8px #bbb',
        }),
    }

    return (
      <Visibility
        once={false}
        onTopPassed={this.handlePass}
        onTopPassedReverse={this.handlePass}
        style={{ margin: '2rem 0' }}
      >
        {/* Ensure anchor links don't occlude card shadow effect */}
        <div id={this.anchorName} style={{ position: 'relative', bottom: '1rem' }} />
        <Grid
          className='docs-example'
          padded='vertically'
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          style={exampleStyle}
        >
          <Grid.Column width={12}>
            <ComponentExampleTitle
              description={description}
              title={title}
              suiVersion={suiVersion}
            />
          </Grid.Column>
          <Grid.Column textAlign='right' width={4}>
            <ComponentControls
              anchorName={this.anchorName}
              examplePath={examplePath}
              onCopyLink={this.handleDirectLinkClick}
              onShowCode={this.handleShowCodeClick}
              onShowHTML={this.handleShowHTMLClick}
              showCode={showCode}
              showHTML={showHTML}
            />
          </Grid.Column>

          {children && (
            <Grid.Column width={16} style={childrenStyle}>
              {children}
            </Grid.Column>
          )}

          <Grid.Column
            width={16}
            className={`rendered-example ${this.getKebabExamplePath()}`}
            style={renderedExampleStyle}
          >
            {exampleElement}
          </Grid.Column>
          {(showCode || showHTML) && (
            <Grid.Column
              width={16}
              style={{ padding: '1rem 0 0', background: EDITOR_BACKGROUND_COLOR }}
            >
              {this.renderJSX()}
              {this.renderHTML()}
            </Grid.Column>
          )}
          {isActive && <CarbonAdNative inverted={this.isActiveState()} />}
        </Grid>
      </Visibility>
    )
  }
}

export default withRouter(ComponentExample)
