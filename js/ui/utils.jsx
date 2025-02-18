var React = require("react");
var ReactDOM = require("react-dom");

import { ContactAwareComponent, MegaRenderMixin, schedule, SoonFcWrap } from "../chat/mixins";

/**
 * jScrollPane helper
 * @type {*|Function}
 */
class JScrollPane extends MegaRenderMixin {
    static defaultProps = {
        className: "jScrollPaneContainer",
        requiresUpdateOnResize: true
    };
    componentDidMount() {
        super.componentDidMount();
        var self = this;
        var $elem = $(ReactDOM.findDOMNode(self));


        $elem.height('100%');

        $elem.find('.jspContainer').replaceWith(
            function() {
                var $children = $elem.find('.jspPane').children();
                if ($children.length === 0 || $children.length > 1) {
                    console.error(
                        "JScrollPane on element: ", $elem, "encountered multiple (or zero) children nodes.",
                        "Mean while, JScrollPane should always (!) have 1 children element."
                    );
                }
                return $children;
            }
        );

        var options = $.extend({}, {
            enableKeyboardNavigation: false,
            showArrows: true,
            arrowSize: 8,
            animateScroll: true,
            container: $('.jspContainer', $elem),
            pane: $('.jspPane', $elem)
        }, self.props.options);

        $elem.jScrollPane(options);


        if (self.props.onFirstInit) {
            self.props.onFirstInit($elem.data('jsp'), $elem);
        }
        $elem.rebind('jsp-will-scroll-y.jsp' + self.getUniqueId(), function(e) {
            if ($elem.attr('data-scroll-disabled') === "true") {
                e.preventDefault();
                e.stopPropagation();

                return false;
            }
        });

        $elem.rebind('jsp-user-scroll-y.jsp' + self.getUniqueId(), function(e, scrollPositionY, isAtTop, isAtBottom) {
            if (self.props.onUserScroll) {
                if ($(e.target).is($elem)) {
                    self.props.onUserScroll(
                        $elem.data('jsp'),
                        $elem,
                        e,
                        scrollPositionY,
                        isAtTop,
                        isAtBottom
                    );
                }
            }

            // if (e.target.className.indexOf("textarea-scroll") > -1) {
            //     return;
            // }
            //
            // if (self.lastScrollPosition === scrollPositionY || self.scrolledToBottom !== 1) {
            //     return;
            // }
            //
            // if (scrollPositionY < 350 && !isAtBottom && self.$messages.is(":visible")) {
            //     if (
            //         self.lastUpdatedScrollHeight !== $jsp.getContentHeight() &&
            //         !self.props.chatRoom.messagesBuff.messagesHistoryIsLoading() &&
            //         self.props.chatRoom.messagesBuff.haveMoreHistory()
            //     ) {
            //         self.props.chatRoom.messagesBuff.retrieveChatHistory();
            //         self.forceUpdate();
            //         self.lastUpdatedScrollHeight = $jsp.getContentHeight();
            //         self.shouldMaintainScroll = true;
            //     }
            // }
            //
            // if (isAtBottom) {
            //     self.lastScrolledToBottom = true;
            // }
            // else {
            //     self.lastScrolledToBottom = false;
            // }
            //
            // self.lastScrollHeight = $jsp.getContentHeight();
            // self.lastScrollPosition = scrollPositionY;
            // self.lastScrollPositionPerc = $jsp.getPercentScrolledY();
        });

        $elem.rebind('forceResize.jsp'+self.getUniqueId(), function(e, forced, scrollPositionYPerc, scrollToElement) {
            self.onResize(forced, scrollPositionYPerc, scrollToElement);
        });
        chatGlobalEventManager.addEventListener('resize', 'jsp' + self.getUniqueId(), self.onResize.bind(self));
        self.onResize();
    }
    componentWillUnmount() {
        super.componentWillUnmount();
        var $elem = $(ReactDOM.findDOMNode(this));
        $elem.off('jsp-will-scroll-y.jsp' + this.getUniqueId());

        chatGlobalEventManager.removeEventListener('resize', 'jsp' + this.getUniqueId());
    }
    eventuallyReinitialise(forced, scrollPositionYPerc, scrollToElement) {
        var self = this;

        if (!self.isMounted()) {
            return;
        }
        if (!self.isComponentVisible()) {
            return;
        }

        var $elem = $(ReactDOM.findDOMNode(self));

        var currHeights = [$('.jspPane', $elem).outerHeight(), $elem.outerHeight()];

        if (forced || self._lastHeights != currHeights) {

            self._lastHeights = currHeights;

            self._doReinit(scrollPositionYPerc, scrollToElement, currHeights, forced, $elem);
        }
    }
    _doReinit(scrollPositionYPerc, scrollToElement, currHeights, forced, $elem) {
        var self = this;

        if (!self.isMounted()) {
            return;
        }
        if (!self.isComponentVisible()) {
            return;
        }

        self._lastHeights = currHeights;
        var $jsp = $elem.data('jsp');
        if ($jsp) {
            $jsp.reinitialise();

            var manualReinitialiseControl = false;
            if (self.props.onReinitialise) {
                manualReinitialiseControl = self.props.onReinitialise(
                    $jsp,
                    $elem,
                    forced,
                    scrollPositionYPerc,
                    scrollToElement
                );
            }

            if (manualReinitialiseControl === false) {
                if (scrollPositionYPerc) {

                    if (scrollPositionYPerc === -1) {
                        $jsp.scrollToBottom();
                    }
                    else {
                        $jsp.scrollToPercentY(scrollPositionYPerc, false);
                    }
                }
                else if (scrollToElement) {
                    $jsp.scrollToElement(scrollToElement);
                }
            }
        }
    }
    onResize(forced, scrollPositionYPerc, scrollToElement) {
        if (forced && forced.originalEvent) {
            forced = true;
            scrollPositionYPerc = undefined;
        }


        this.eventuallyReinitialise(forced, scrollPositionYPerc, scrollToElement);
    }
    componentDidUpdate() {
        this.onResize();
    }
    render() {
        return (
            <div className={this.props.className}>
                <div className="jspContainer">
                    <div className="jspPane">
                        {this.props.children}
                    </div>
                </div>
            </div>
        );
    }
};

/**
 * A trick copied from http://jamesknelson.com/rendering-react-components-to-the-document-body/
 * so that we can render Dialogs into the body or other child element, different then the current component's child.
 */
class RenderTo extends React.Component {
    componentDidMount() {
        if (super.componentDidMount) {
            super.componentDidMount();
        }
        this.popup = document.createElement("div");
        this._setClassNames();
        if (this.props.style) {
            $(this.popup).css(this.props.style);
        }
        this.props.element.appendChild(this.popup);
        var self = this;
        this._renderLayer(function() {
            if (self.props.popupDidMount) {
                self.props.popupDidMount(self.popup);
            }
        });
    }
    componentDidUpdate() {
        this._setClassNames();
        this._renderLayer();
    }
    componentWillUnmount() {
        if (super.componentWillUnmount) {
            super.componentWillUnmount();
        }
        ReactDOM.unmountComponentAtNode(this.popup);
        if (this.props.popupWillUnmount) {
            this.props.popupWillUnmount(this.popup);
        }
        this.props.element.removeChild(this.popup);
    }
    _setClassNames() {
        this.popup.className = this.props.className ? this.props.className : "";
    }
    _renderLayer(cb) {
        ReactDOM.render(this.props.children, this.popup, cb);
    }
    render() {
        // Render a placeholder
        return null;
    }
};

export const withOverflowObserver = Component =>
    class extends ContactAwareComponent {
        displayName = 'OverflowObserver';
        ref = React.createRef();

        state = {
            overflowed: false
        };

        handleMouseEnter = () => {
            const element = this.ref && this.ref.current;
            if (element) {
                this.setState({ overflowed: element.scrollWidth > element.offsetWidth });
            }
        };

        shouldComponentUpdate(nextProps, nextState) {
            return (
                nextState.overflowed !== this.state.overflowed ||
                (nextProps.children !== this.props.children || nextProps.content !== this.props.content)
            );
        }

        render() {
            const { simpletip } = this.props;

            return (
                <div
                    ref={this.ref}
                    className={`
                        overflow-observer
                        ${this.state.overflowed ? 'simpletip simpletip-tc' : ''}
                    `}
                    data-simpletipposition={simpletip?.position || 'top'}
                    data-simpletipoffset={simpletip?.offset}
                    data-simpletip-class={simpletip?.className}
                    onMouseEnter={this.handleMouseEnter}>
                    <Component {...this.props} />
                </div>
            );
        }
    };

export const Emoji = ({ children }) => {
    return <ParsedHTML content={megaChat.html(children)} />;
};

export class ParsedHTML extends React.Component {
    ref = React.createRef();

    updateInternalState = () => {
        const { children, content } = this.props;
        const ref = this.ref && this.ref.current;

        if (!children && !content) {
            return d > 1 && console.warn('Emoji: No content passed.');
        }

        if (ref) {
            if (ref.childNodes.length) {
                while (ref.firstChild) {
                    ref.removeChild(ref.firstChild);
                }
            }
            ref.appendChild(parseHTML(children || content));
        }
    };

    shouldComponentUpdate(nextProps) {
        return (
            nextProps && (nextProps.children !== this.props.children || nextProps.content !== this.props.content)
        );
    }

    componentDidUpdate() {
        this.updateInternalState();
    }

    componentDidMount() {
        this.updateInternalState();
    }

    render() {
        const { className, onClick, tag } = this.props;
        const Tag = tag || 'span';

        return (
            <Tag
                ref={this.ref}
                className={className}
                onClick={onClick}
            />
        );
    }
}

export const OFlowEmoji = withOverflowObserver(Emoji);
export const OFlowParsedHTML = withOverflowObserver(ParsedHTML);

export default {
    JScrollPane,
    RenderTo,
    schedule,
    SoonFcWrap,
    OFlowEmoji,
    OFlowParsedHTML,
};
