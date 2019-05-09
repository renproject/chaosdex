// tslint:disable:no-any

import axios from "axios";

export interface GitAsset {
    url: string;
    id: number;
    node_id: string;
    name: string;
    label: any;
    uploader: any;
    content_type: string;
    state: string;
    size: number;
    download_count: number;
    created_at: string;
    updated_at: string;
    browser_download_url: string;
}

export interface GitRelease {
    url: string;
    assets_url: string;
    upload_url: string;
    html_url: string;
    id: number;
    node_id: string;
    tag_name: string;
    target_commitish: string;
    name: string;
    draft: boolean;
    author: any;
    prerelease: boolean;
    created_at: string;
    published_at: string;
    assets: GitAsset[];
    tarball_url: string;
    zipball_url: string;
    body: string;
}

/**
 * Gets the latest releases of a Github Repo
 *
 * @param project needs to be in the form of name/repo. e.g. renproject/swapperd-desktop
 */
const getLatestRelease = async (project: string): Promise<GitRelease> => {
    const url = `https://api.github.com/repos/${project}/releases/latest`;
    const postResponse = await axios({
        method: "GET",
        url,
    });
    return postResponse.data as GitRelease;
};

export const getLatestReleaseVersion = async (project: string): Promise<string> => {
    const release: GitRelease = await getLatestRelease(project);
    return release.tag_name;
};

const getLatestAssets = async (project: string): Promise<GitAsset[]> => {
    const release: GitRelease = await getLatestRelease(project);
    return release.assets;
};

export const getDownloadLinks = async (project: string, filenames: string[]): Promise<Map<string, string>> => {
    const result = new Map<string, string>();
    const assets = await getLatestAssets(project);
    for (const asset of assets) {
        if (filenames.includes(asset.name)) {
            result.set(asset.name, asset.browser_download_url);
        }
    }
    return result;
};

// tslint:enable:no-any
