import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { onRequest } from "firebase-functions/v2/https";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_PAT;
const ORGANIZATION = process.env.GITHUB_ORG;
const REPO_LIST: string[] = process.env.REPO_LIST ? process.env.REPO_LIST.split(',') : [];

if (!GITHUB_TOKEN || !ORGANIZATION || REPO_LIST.length === 0) {
    console.error("Missing required environment variables: GITHUB_PAT, GITHUB_ORG, REPO_LIST");
    process.exit(1);
}

// GitHub API Headers
const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json"
};

interface PullRequest {
    repository: string;
    title: string;
    number: number;
    author: string;
    created_at: string;
    days_open: number;
    approvals: number;
}

const timeSince = (date: string): number => {
    const now = new Date();
    const openedAt = new Date(date);
    const diffInMs = now.getTime() - openedAt.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24)); // Convert to days
};

// Fetch Open PRs for a Single Repository
const getOpenPRs = async (repo: string): Promise<PullRequest[]> => {
    try {
        const url = `https://api.github.com/repos/${ORGANIZATION}/${repo}/pulls?state=open`;
        const response = await axios.get(url, { headers });
        const pullRequests = response.data;
        const openPullRequests = pullRequests.filter((pr: any) => !pr.draft);

        // Fetch reviews for each PR to count approvals
        const prDetails = await Promise.all(openPullRequests.map(async (pr: any) => {
            const reviewUrl = `https://api.github.com/repos/${ORGANIZATION}/${repo}/pulls/${pr.number}/reviews`;
            const reviewResponse = await axios.get(reviewUrl, { headers });

            const approvals = reviewResponse.data.filter((review: any) => review.state === "APPROVED").length;

            return {
                repository: repo,
                title: pr.title,
                number: pr.number,
                author: pr.user.login, // PR author
                created_at: pr.created_at,
                days_open: timeSince(pr.created_at),
                approvals
            };
        }));

        return prDetails;
    } catch (error: any) {
        console.error(`Error fetching PRs for ${repo}:`, error.response?.data || error.message);
        return [];
    }
};

// Fetch Open PRs for All Repositories
const getAllOpenPRs = async (): Promise<Record<string, PullRequest[]>> => {
    const allPRs = await Promise.all(REPO_LIST.map(repo => getOpenPRs(repo)));
    const flatPRs = allPRs.flat();

    // Group by repository
    return flatPRs.reduce((acc: Record<string, PullRequest[]>, pr) => {
        acc[pr.repository] = acc[pr.repository] || [];
        acc[pr.repository].push(pr);
        return acc;
    }, {});
};


// GET Endpoint
app.get('/open-prs', async (req: Request, res: Response) => {
    try {
        const openPRs = await getAllOpenPRs();
        res.json(openPRs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch PR data' });
    }
});


// Start Express Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Wrapper for GCP Cloud Fn - entrypoint
// export const demoCloudFunction = onRequest(app);
