/**
 * Where the signed-out interview lives. Deliberately outside `/app`, so the auth
 * matcher in `middleware.ts` does not gate it — see `config.matcher` there. Shared by
 * the landing CTAs so they can never disagree about the path.
 */
export const GUEST_INTERVIEW_PATH = "/start";
