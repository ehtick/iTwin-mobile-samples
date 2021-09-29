/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BottomPanel, BottomPanelProps } from "@itwin/mobile-ui-react";
import { HeaderTitle } from "./Exports";

import "./InfoBottomPanel.scss";

/// Properties for the [[InfoBottomPanel]] React component.
interface InfoBottomPanelProps extends BottomPanelProps {
  /// The name of the iModel.
  name: string;
  /// The path for the iModel.
  filename: string;
}

/// [[BottomPanel]] React component that shows the iModel name and path.
export function InfoBottomPanel(props: InfoBottomPanelProps) {
  const { name, filename } = props;
  return (
    <BottomPanel {...props} className="info-bottom-panel">
      <HeaderTitle label={name} iconSpec="icon-info-hollow" />
      <div>Path: {filename}</div>
    </BottomPanel>
  );
}
