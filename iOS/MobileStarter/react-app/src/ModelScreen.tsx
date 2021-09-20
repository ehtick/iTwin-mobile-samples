/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { ColorDef } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { getCssVariable, IconSpec } from "@bentley/ui-core";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";
import { ActionSheetAction, presentAlert } from "@itwin/mobile-core";
import {
  ActionSheetButton,
  IconImage,
  MobileUiContent,
  NavigationPanel,
  TabOrPanelDef,
  useIsMountedRef,
  useTabsAndStandAlonePanels,
  VisibleBackButton,
} from "@itwin/mobile-ui-react";
import { AboutBottomPanel, ElementPropertiesPanel, InfoBottomPanel, ViewsBottomPanel } from "./Exports";
import "./ModelScreen.scss";

// tslint:disable-next-line: variable-name
const UnifiedSelectionViewportComponent = viewWithUnifiedSelection(ViewportComponent);

/// Properties for the [[ModelScreen]] React component.
export interface ModelScreenProps {
  /// The full path to the currently loaded iModel.
  filename: string;
  /// The currently loaded iModel.
  iModel: IModelConnection;
  /// Callback to go back to the previous screen.
  onBack: () => void;
}

// Set the model background color based on the currently active dark/light color scheme.
export function updateBackgroundColor(viewState: ViewState) {
  const displayStyle = viewState.displayStyle;
  // Note: the value of the --background-color CSS variable automatically updates when the
  // color scheme of the web view changes.
  const bgColor = getCssVariable("--background-color");
  displayStyle.backgroundColor = ColorDef.fromString(bgColor);
}

/// React component showing the iModel and containing UI for interacting with it.
export function ModelScreen(props: ModelScreenProps) {
  const tabsAndPanelsAPI = useTabsAndStandAlonePanels();
  const { filename, iModel, onBack } = props;
  const lastSlash = filename.lastIndexOf("/");
  const documentName = lastSlash === -1 ? filename : filename.substring(lastSlash + 1);
  const [viewState, setViewState] = React.useState<ViewState>();
  const elementPropertiesLabel = "Properties";
  // Any time we do anything asynchronous, we have to check if the component is still mounted,
  // or it can lead to a run-time exception.
  const isMountedRef = useIsMountedRef();
  const moreActions = () => {
    const actions: ActionSheetAction[] =
      [
        {
          name: "sample",
          title: "Sample alert...",
          onSelected: () => {
            presentAlert({
              title: "Information",
              message: "Sample alert clicked.",
              actions: [{
                name: "ok",
                title: "OK",
              }],
            })
          },
        },
      ];

    if (IModelApp.viewManager.getFirstOpenView()?.view.iModel.selectionSet.isActive) {
      actions.push(
        {
          name: elementPropertiesLabel,
          title: elementPropertiesLabel,
          onSelected: () => { tabsAndPanelsAPI.openPanel(elementPropertiesLabel) },
        });
    }
    return actions;
  };
  const moreButton = <ActionSheetButton actions={moreActions} />
  const panels: TabOrPanelDef[] = [
    {
      label: "Info",
      isTab: true,
      popup: <InfoBottomPanel
        key="info"
        name={documentName}
        filename={filename}
      />
    },
    {
      label: "About",
      isTab: true,
      popup: <AboutBottomPanel key="about" />
    },
    {
      label: "Views",
      isTab: true,
      popup: <ViewsBottomPanel
        key="views"
        iModel={iModel}
        // Close the Views bottom panel when a view is selected from it.
        onViewSelected={() => { tabsAndPanelsAPI.closeSelectedPanel(); }}
      />
    },
    {
      label: elementPropertiesLabel,
      isTab: false,
      popup: <ElementPropertiesPanel
        key={elementPropertiesLabel}
        iModel={iModel}
        onCloseClick={() => tabsAndPanelsAPI.closeSelectedPanel()}
        onAutoClose={() => {
          tabsAndPanelsAPI.closeSelectedPanel();
          return tabsAndPanelsAPI.autoCloseHandler();
        }}
      />
    },
  ];

  tabsAndPanelsAPI.setPanels(panels);

  // Effect to update the model background color when the color scheme changes.
  React.useEffect(() => {
    const colorSchemeListener = () => {
      const viewState = IModelApp.viewManager.getFirstOpenView()?.view;
      if (viewState) {
        updateBackgroundColor(viewState);
      }
    };
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', colorSchemeListener);
    } catch (e) {
      // Safari didn't support the above BASIC functionality until version 14.
      window.matchMedia('(prefers-color-scheme: dark)').addListener(colorSchemeListener);
    }
    return () => {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', colorSchemeListener);
      } catch (e) {
        // Safari didn't support the above BASIC functionality until version 14.
        window.matchMedia('(prefers-color-scheme: dark)').removeListener(colorSchemeListener);
      }
    }
  }, []);

  // Effect to load the default view state.
  React.useEffect(() => {
    // React.useEffect callbacks cannot be async, since they have a meaningful return value that is
    // not a Promise.
    const loadViewState = async () => {
      try {
        const defaultViewId = await iModel.views.queryDefaultViewId();
        const defaultViewState = await iModel.views.load(defaultViewId);
        if (!isMountedRef.current) return;
        updateBackgroundColor(defaultViewState);
        setViewState(defaultViewState);
      } catch (error) {
        // This should never happen in a non-corrupt iModel.
        console.error("Error loading default view state: " + error);
      }
    };
    loadViewState();
  }, [iModel.views, isMountedRef]);

  // Note: Changes to the [[viewState]] field of [[ViewportProps]] are ignored after the component is
  // first created. So don't create the [[ViewportComponent]] until after we have loaded the default
  // view state.
  return (
    <MobileUiContent>
      {viewState &&
        <div id="main-viewport">
          <UnifiedSelectionViewportComponent imodel={iModel} viewState={viewState} />
        </div>
      }
      <NavigationPanel
        left={
          <>
            <VisibleBackButton onClick={onBack} />
          </>
        }
        right={
          <>
            {moreButton}
          </>
        }
      />
      {tabsAndPanelsAPI.renderTabBarAndPanels()}
    </MobileUiContent >
  );
}

export interface HeaderTitleProps {
  iconSpec?: IconSpec;
  label?: string;
}

export function HeaderTitle(props: HeaderTitleProps) {
  const { iconSpec, label } = props;
  return <div className="title">
    {iconSpec && <IconImage style={{ display: "inline-block", marginRight: 10 }} iconSpec={iconSpec} />}
    {label}
  </div>;
}
