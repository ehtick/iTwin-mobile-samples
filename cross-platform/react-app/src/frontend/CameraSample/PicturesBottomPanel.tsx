/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import ReactDOM from "react-dom";
import classnames from "classnames";
import { IModelConnection } from "@itwin/core-frontend";
import {
  MobileCore,
  presentYesNoAlert,
  ReloadedEvent,
} from "@itwin/mobile-sdk-core";
import { DraggableComponent, NavigationButton, ResizableBottomPanel, ResizableBottomPanelProps, ToolButton, useBeUiEvent } from "@itwin/mobile-ui-react";
import { HeaderTitle } from "../Exports";
import { CameraSampleAppGetLocalizedString, ImageCache, ImageMarkerApi } from "./Exports";

import "./PicturesBottomPanel.scss";

/** Properties for the {@link PicturesBottomPanel} React component. */
export interface PicturesBottomPanelProps extends ResizableBottomPanelProps {
  /** The loaded iModel. */
  iModel: IModelConnection;
}

function i18n(key: string) {
  return CameraSampleAppGetLocalizedString("PicturesBottomPanel", key);
}

/**
 * `ResizableBottomPanel` React component that allows the user to take pictures with the device's camera.
 *
 * Shows the pictures that have been taken for the selected iModel. Allows the user to take more, as well as
 * delete individual pictures or all pictures.
 */
export function PicturesBottomPanel(props: PicturesBottomPanelProps) {
  const { iModel, ...otherProps } = props;
  const picturesLabel = React.useMemo(() => i18n("Pictures"), []);
  const reloadedEvent = React.useRef(new ReloadedEvent());
  const [pictureUrls, setPictureUrls] = React.useState<string[]>([]);
  const deletePictureTitle = React.useMemo(() => i18n("DeletePictureTitle"), []);
  const deletePictureMessage = React.useMemo(() => i18n("DeletePictureMessage"), []);
  const deleteAllTitle = React.useMemo(() => i18n("DeleteAllTitle"), []);
  const deleteAllMessage = React.useMemo(() => i18n("DeleteAllMessage"), []);
  const deleteSelectedTitle = React.useMemo(() => i18n("DeleteSelectedTitle"), []);
  const deleteSelectedMessage = React.useMemo(() => i18n("DeleteSelectedMessage"), []);
  const [decoratorActive, setDecoratorActive] = React.useState(true);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedUrls, setSelectedUrls] = React.useState(new Set<string>());

  const reload = React.useCallback(async () => {
    const urls = await ImageCache.getImages(iModel.iModelId);
    urls.sort();
    setPictureUrls(urls);
    if (urls.length === 0) {
      setSelectMode(false);
      setSelectedUrls(new Set<string>());
    }
    reloadedEvent.current.emit();
  }, [iModel]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  useBeUiEvent(async () => reload(), ImageMarkerApi.onMarkerAdded);

  const togglePictureSelected = React.useCallback((pictureUrl: string) => {
    setSelectedUrls((previousSelectedUrls) => {
      const newSelected = new Set<string>(previousSelectedUrls);
      if (newSelected.has(pictureUrl))
        newSelected.delete(pictureUrl);
      else
        newSelected.add(pictureUrl);
      return newSelected;
    });
  }, []);

  const handlePictureClick = React.useCallback((pictureUrl: string) => {
    if (selectMode) {
      togglePictureSelected(pictureUrl);
    } else {
      ImageMarkerApi.onImageSelected.emit(pictureUrl);
    }
  }, [selectMode, togglePictureSelected]);

  const getShareIcon = () => MobileCore.isIosPlatform ? "icon-upload" : "icon-share";

  const pictureButtons = pictureUrls.map((pictureUrl, index) => {
    const selected = selectedUrls.has(pictureUrl);
    return (
      <div className={classnames("list-item", selectMode && selected && "selected")} key={index} onClick={() => handlePictureClick(pictureUrl)}>
        <img src={pictureUrl} alt="" />
        {!selectMode && <NavigationButton
          className="share-button"
          iconSpec={getShareIcon()}
          onClick={(e) => {
            void ImageCache.shareImages([pictureUrl], e.currentTarget.parentElement?.getBoundingClientRect());
          }}
        />}
        {!selectMode && <NavigationButton
          className="delete-button"
          iconSpec={"icon-delete"}
          onClick={async () => {
            if (await presentYesNoAlert(deletePictureTitle, deletePictureMessage, true)) {
              await ImageCache.deleteImages([pictureUrl]);
              void reload();
            }
          }}
        />}
        {selectMode && selected && <NavigationButton
          className="select-button"
          iconSpec="icon-checkmark"
          iconSize="18px"
        />}
      </div>
    );
  });

  // Add 10 0-height dummy items after the real items to force the last row to be left-justified.
  const dummyItems: React.ReactNode[] = [];
  for (let i = 0; i < 10; ++i) {
    dummyItems.push(<div className="dummy-item" key={i + pictureUrls.length} />);
  }

  const headerMoreElements = (
    <div className="header-right">
      {pictureUrls.length > 0 && <NavigationButton iconSpec={"icon-edit"} noShadow
        style={{ color: (selectMode ? "var(--muic-active)" : "var(--muic-foreground)") }}
        onClick={() => {
          setSelectMode(!selectMode);
        }} />}
      {!selectMode && <>
        <ToolButton iconSpec={"icon-camera"} onClick={async () => {
          if (await ImageCache.pickImage(iModel.iModelId)) {
            void reload();
          }
        }} />
        <ToolButton iconSpec={"icon-image"} onClick={async () => {
          if (await ImageCache.pickImage(iModel.iModelId, true)) {
            void reload();
          }
        }} />
        <NavigationButton iconSpec="icon-visibility" noShadow
          style={{ color: (decoratorActive ? "var(--muic-active)" : "var(--muic-foreground)") }}
          onClick={() => {
            ImageMarkerApi.enabled = !ImageMarkerApi.enabled;
            setDecoratorActive(ImageMarkerApi.enabled);
          }} />
      </>}
      {selectMode && <>
        <ToolButton iconSpec={"icon-checkbox-select"} enabled={pictureUrls.length > 0} onClick={() => {
          if (selectedUrls.size === pictureUrls.length)
            setSelectedUrls(new Set());
          else
            setSelectedUrls(new Set(pictureUrls));
        }} />
        <ToolButton iconSpec={getShareIcon()} enabled={selectedUrls.size > 0}
          onClick={(e) => {
            void ImageCache.shareImages(Array.from(selectedUrls), e.currentTarget.getBoundingClientRect());
          }} />
        <ToolButton
          iconSpec={"icon-delete"}
          enabled={selectedUrls.size > 0}
          onClick={async () => {
            const all = pictureUrls.length === selectedUrls.size;
            if (all && await presentYesNoAlert(deleteAllTitle, deleteAllMessage, true)) {
              await ImageCache.deleteAllImages(iModel.iModelId);
              void reload();
            } else if (!all && await presentYesNoAlert(deleteSelectedTitle, deleteSelectedMessage, true)) {
              await ImageCache.deleteImages(Array.from(selectedUrls));
              void reload();
            }
          }}
        />
      </>}
    </div>
  );

  return (
    <ResizableBottomPanel
      {...otherProps}
      className="pictures-bottom-panel"
      header={<DraggableComponent className="resizable-panel-header">
        <HeaderTitle
          label={picturesLabel}
          iconSpec="icon-saved-view"
          moreElements={headerMoreElements}
        />
      </DraggableComponent>}
      reloadedEvent={reloadedEvent.current}
    >
      <div className="list">
        <div className="list-items">
          {pictureButtons}
          {dummyItems}
        </div>
      </div>
    </ResizableBottomPanel>
  );
}

export interface PictureViewProps {
  url: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function PictureView(props: PictureViewProps) {
  const { url, onClick } = props;
  const portalDiv = (
    <div className="picture-view" onClick={onClick}>
      <img src={url} alt="" />
    </div>
  );
  const rootElement = document.getElementById("root");
  return ReactDOM.createPortal(portalDiv, rootElement!);
}
