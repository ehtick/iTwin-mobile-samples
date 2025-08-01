/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { useIsMountedRef } from "@itwin/mobile-ui-react";
import { DownloadBriefcaseOptions, DownloadProgressInfo, NativeApp } from "@itwin/core-frontend";
import { MinimalIModel } from "@itwin/imodels-client-management";
import { BriefcaseDownloader, LocalBriefcaseProps, SyncMode } from "@itwin/core-common";
import { BentleyError, BriefcaseStatus, IModelStatus } from "@itwin/core-bentley";
import { ProgressRadial } from "@itwin/itwinui-react";
import { Button, IModelInfo, presentError, useLocalizedString } from "../../Exports";

/**
 * Get the briefcase filename for the given iModel.
 * @param iModelId The iModel's ID.
 * @returns The full path to the iModel's briefcase file.
 */
export async function getBriefcaseFileName(iModelId: string): Promise<string> {
  const cachedBriefcases = await NativeApp.getCachedBriefcases(iModelId);
  if (cachedBriefcases.length > 0) {
    return cachedBriefcases[0].fileName;
  } else {
    return NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: 0 });
  }
}

/**
 * Download the given iModel, reporting progress via {@link handleProgress}.
 * @param iTwinId The iModel's iTwin (project) ID.
 * @param iModel The iModel to download.
 * @param handleProgress Progress callback.
 * @returns The {@link LocalBriefcaseProps} for the downloaded iModel if successful, otherwise
 * undefined.
 */
async function downloadIModel(iTwinId: string, iModel: MinimalIModel, handleProgress: (progress: DownloadProgressInfo) => boolean): Promise<LocalBriefcaseProps | undefined> {
  const opts: DownloadBriefcaseOptions = {
    syncMode: SyncMode.PullAndPush,
    progressCallback: async (progress: DownloadProgressInfo) => {
      if (!handleProgress(progress)) {
        await downloader?.requestCancel();
        canceled = true;
      }
    },
  };
  let downloader: BriefcaseDownloader | undefined;
  let canceled = false;
  try {
    downloader = await NativeApp.requestDownloadBriefcase(iTwinId, iModel.id, opts);

    if (canceled) {
      // If we got here we canceled before the initial return from NativeApp.requestDownloadBriefcase
      void downloader.requestCancel();
      return undefined;
    }

    // Wait for the download to complete.
    await downloader.downloadPromise;
    const localBriefcases = await NativeApp.getCachedBriefcases(iModel.id);
    if (localBriefcases.length === 0) {
      // This should never happen, since we just downloaded it, but check, just in case.
      console.error("Error downloading iModel.");
    }
    return localBriefcases[0];
  } catch (error) {
    if (error instanceof BentleyError) {
      if (error.errorNumber === (IModelStatus.FileAlreadyExists as number)) {
        // When a download is canceled, the partial briefcase file does not get deleted, which causes
        // any subsequent download attempt to fail with this error number. If that happens, delete the
        // briefcase and try again.
        try {
          const fileName = await getBriefcaseFileName(iModel.id);
          await NativeApp.deleteBriefcase(fileName);
          return await downloadIModel(iTwinId, iModel, handleProgress);
        } catch { }
      } else if (error.errorNumber === (BriefcaseStatus.DownloadCancelled as number) && canceled) {
        // When we call requestCancel, it causes the downloader to throw this error; ignore.
        return undefined;
      }
    }
    // There was an error downloading the iModel. Show the error
    void presentError("DownloadErrorFormat", error, "HubScreen");
  }
  return undefined;
}

/** Properties for the {@link IModelDownloader} React component. */
export interface IModelDownloaderProps {
  iTwinId: string;
  model: IModelInfo;
  onDownloaded: (model: IModelInfo) => void;
  onCanceled: () => void;
}

/** React component that downloads an iModel and shows download progress. */
export function IModelDownloader(props: IModelDownloaderProps) {
  const { iTwinId, model, onDownloaded, onCanceled } = props;
  const [progress, setProgress] = React.useState(0);
  const [indeterminate, setIndeterminate] = React.useState(true);
  const downloadingRef = React.useRef(false);
  const canceledRef = React.useRef(false);
  const isMountedRef = useIsMountedRef();
  const downloadingLabel = useLocalizedString("HubScreen", "Downloading");
  const cancelLabel = useLocalizedString("HubScreen", "Cancel");

  // Progress callback for iModel download.
  const handleProgress = React.useCallback((progressInfo: DownloadProgressInfo) => {
    if (isMountedRef.current) {
      const percent: number = progressInfo.total !== 0 ? Math.round(100.0 * progressInfo.loaded / progressInfo.total) : 0;
      setProgress(percent);
      setIndeterminate(progressInfo.total === 0);
    }
    return isMountedRef.current && !canceledRef.current;
    // NOTE: the isMountedRef returned by useIsMountedRef does not ever change, even though eslint
    // thinks it might. Also, since this callback is passed as an argument to downloadIModel, if it
    // ever changed then it would NOT work, since there is no way to update the progress callback
    // on an active download. So, even though putting isMountedRef in the dependency array would
    // produce the same behavior, it is intentionally omitted to make it clear that this callback
    // never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Startup effect to initiate the iModel download.
  React.useEffect(() => {
    // We only want to download once.
    if (downloadingRef.current) return;

    const fetchIModel = async () => {
      const minimalIModel = model.minimalIModel;
      const briefcase = await downloadIModel(iTwinId, minimalIModel, handleProgress);
      if (!isMountedRef.current) return;
      onDownloaded({ minimalIModel, briefcase });
    };
    downloadingRef.current = true;
    void fetchIModel();
  }, [handleProgress, isMountedRef, model.minimalIModel, onDownloaded, iTwinId]);

  return <div className="centered-list">
    <div>{downloadingLabel}</div>
    <div style={{ paddingBottom: 10 }}>{model.minimalIModel.displayName}</div>
    <ProgressRadial value={progress} indeterminate={indeterminate}>{indeterminate ? "" : progress.toString()}</ProgressRadial>
    <Button title={cancelLabel} onClick={() => {
      canceledRef.current = true;
      onCanceled();
    }} />
  </div>;
}
