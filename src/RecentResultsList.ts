import { Component, IComponentBindings, ComponentOptions, IQueryResult, LocalStorageUtils, $$, Dom, Utils, IChangeAnalyticsCustomDataEventArgs, analyticsActionCauseList } from 'coveo-search-ui';
import { lazyComponent } from '@coveops/turbo-core';

export interface IRecentResultsListOptions {
    results: IQueryResult[];
    maxLength: number;
    recentResultTemplate?: Coveo.Template;
}

@lazyComponent
export class RecentResultsList extends Component {
    static ID = 'RecentResultsList';
    static options: IRecentResultsListOptions = {
      maxLength: ComponentOptions.buildNumberOption({defaultValue: 10}),
      results: <any>ComponentOptions.buildJsonOption({defaultValue: []}),
      recentResultTemplate: ComponentOptions.buildTemplateOption({
          defaultFunction: (e) => Coveo.HtmlTemplate.fromString(RecentResultsList.defaultRecentResultsTemplate, {}),
          selectorAttr: 'data-template-selector',
          idAttr: 'data-template-id'
      })
    };

    static actionCauseList = [
      analyticsActionCauseList.documentOpen.name,
      analyticsActionCauseList.documentQuickview.name
    ]

    static defaultRecentResultsTemplate = `<div class="CoveoResultLink"></div>`;

    public recentResults: IQueryResult[];
    private analyticsElement: HTMLElement;
    private recentResultsContainer: HTMLElement;
    private recentResultsLocalStorage: LocalStorageUtils<IQueryResult[]>;
    

    constructor(public element: HTMLElement, public options: IRecentResultsListOptions, public bindings: IComponentBindings) {
        super(element, RecentResultsList.ID, bindings);
        this.options = ComponentOptions.initComponentOptions(element, RecentResultsList, options);

        this.analyticsElement = $$(this.root).find(`.${Component.computeCssClassNameForType('Analytics')}`);
        if (!this.analyticsElement) {
          this.logger.warn(`Cannot instantiate RecentResultsList, as there is no "CoveoAnalytics" in your page !`);
          return;
        }

        this.recentResultsLocalStorage = new LocalStorageUtils<IQueryResult[]>(RecentResultsList.ID);
        this.mergeLocalResultsWithStaticResults();

        this.bindAnalyticsEvent();
        this.createDom();
    }

    createDom() {
        this.recentResultsContainer = $$('div', { class: 'coveo-recent-results-list-container' }).el;

        const header = $$('div', { class: 'coveo-recent-results-list-header' });
        const body = $$('div', { class: 'coveo-recent-results-list-body' });
        const title = $$('div', { class: 'coveo-recent-results-list-title' }, Coveo.l('RecentResultsList_Title'));
        header.append(title.el);
        body.append(this.recentResultsContainer);
        this.element.appendChild(header.el);
        this.element.appendChild(body.el);

        this.updateRecentResults(this.recentResults);
    }

    private bindAnalyticsEvent() {
      this.bind.onRootElement(Coveo.AnalyticsEvents.changeAnalyticsCustomData, (args: IChangeAnalyticsCustomDataEventArgs) => this.handleChangeAnalyticsCustomData(args));
    }

    private handleChangeAnalyticsCustomData(args: IChangeAnalyticsCustomDataEventArgs) {
      if (args.type == 'ClickEvent' && RecentResultsList.actionCauseList.includes(args.actionCause) && args['resultData']) {
          const { searchInterface, ...result} = args['resultData'];
          this.addToRecentResults(this.resetHightlights(result));
          this.save();
      }
    }

    private resetHightlights(result) {
      return {
        ...result,
        excerptHighlights:[],
        firstSentencesHighlights:[],
        phrasesToHighlights:[],
        printableUriHighlights:[],
        summaryHighlights:[],
        titleHighlights:[] 
      }
    }

    private mergeLocalResultsWithStaticResults() {
      const staticResults = this.options.results;
      const localResults = this.recentResultsLocalStorage.load() || [];

      if(staticResults.length){
        const localResultsWithoutRemoved = _.filter(localResults, localResult => {
          const existsInStatic = _.find(staticResults, staticResult => {
            return staticResult.uniqueId == localResult.uniqueId;
          });
          return existsInStatic != undefined;
        });

        this.recentResults = <IQueryResult[]>Utils.extendDeep(staticResults, localResultsWithoutRemoved);
      } else {
        this.recentResults = localResults;
      }
    }

    private save() {
        this.logger.info('Saving recent result', this.recentResults);
        this.recentResultsLocalStorage.save(this.recentResults);
        this.updateRecentResults(this.recentResults);
    }

    private addToRecentResults(result: IQueryResult){

      if(this.recentResults.length) {
        this.recentResults.unshift(result);
      } else {
        this.recentResults.push(result);
      }

      
      if(this.recentResults.length > this.options.maxLength){
        this.recentResults.pop();
      }
    }

    public async updateRecentResults(results: IQueryResult[]) {
        if (this.recentResultsContainer) {
            this.recentResultsContainer.innerHTML = '';

            if(results.length){ 

              for (const r of results) {
                  const domRecentResult = await this.prepareRecentResult(r);
                  const coveoResult = $$('div', { class: 'CoveoResult' }, domRecentResult );
                  this.recentResultsContainer.appendChild(coveoResult.el);
              }

            } else {
              const noRecentResult = $$('div', { class: 'coveo-recent-results-list-no-result' }, Coveo.l('RecentResultsList_NoResults') );
              this.recentResultsContainer.appendChild(noRecentResult.el);
            }
            
        } else {
          this.logger.error('recentResultsContainer is null');
        }
    }

    private async prepareRecentResult(result: IQueryResult): Promise<Dom> {
        const domContent = await this.instantiateTemplateToDom(result);

        const initOptions = this.searchInterface.options;
        const initParameters: Coveo.IInitializationParameters = {
          options: initOptions,
          bindings: this.getBindings(),
          result: result
        };

        await Coveo.Initialization.automaticallyCreateComponentsInside(domContent.el, initParameters).initResult;
        return domContent;
    }

    private async instantiateTemplateToDom(result: IQueryResult): Promise<Dom> {
      let templateInstantiated: HTMLElement;
      templateInstantiated = await this.options.recentResultTemplate.instantiateToElement(result) as HTMLElement;
      return $$(templateInstantiated);
    }
    
}