import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {getConfig} from "./config.js";

// 确保 Firebase Admin 已初始化
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Callable 函数：获取当前用户的视频列表
 *
 * 功能：
 * 从 Firestore 的 video_tasks 集合中获取当前用户的所有视频
 * 对于 processing 状态的视频，会查询 HeyGen API 获取最新状态和进度
 *
 * 返回：
 * - 视频列表（包含 video_id, video_url, status, progress 等）
 */
export const getUserVideos = functions
  .region("us-west1")
  .https.onCall(
    async (data, context) => {
    // 1. 验证用户是否已登录
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "login required"
        );
      }

      const uid = context.auth.uid;

      try {
      // 2. 从 video_tasks 集合中查询该用户的所有任务
      // 注意：不使用 orderBy 以避免需要复合索引，我们在内存中排序
        let videoTasksSnapshot;
        try {
          videoTasksSnapshot = await db
            .collection("video_tasks")
            .where("uid", "==", uid)
            .get();
        } catch (error) {
        // 如果集合不存在或查询失败，返回空结果
          functions.logger.error("查询 video_tasks 集合失败:", error);
          throw error;
        }

        const videos: Array<{
        video_id: string;
        video_url: string | null;
        status: string;
        progress: number | null;
        image_url: string | null;
        script: string | null;
        avatar_id: string | null;
        voice_id: string | null;
        error_code: string | null;
        error_message: string | null;
        error_detail: string | null;
        created_at: string | null;
        updated_at: string | null;
      }> = [];

        // 3. 获取配置（用于查询 processing 状态的视频）
        let config: ReturnType<typeof getConfig> | undefined;
        try {
          config = getConfig();
        } catch (error) {
          functions.logger.warn("无法获取配置，跳过 API 查询");
          config = undefined;
        }

        // 4. 分离 processing 视频和其他视频，以便并发处理
        const processingVideos: Array<{
        doc: admin.firestore.QueryDocumentSnapshot;
        videoId: string;
        data: admin.firestore.DocumentData;
      }> = [];

        const otherVideos: Array<{
        doc: admin.firestore.QueryDocumentSnapshot;
        videoId: string;
        data: admin.firestore.DocumentData;
      }> = [];

        for (const doc of videoTasksSnapshot.docs) {
          const data = doc.data();
          const status = data.status || "unknown";

          if (status === "processing" && config) {
            processingVideos.push({doc, videoId: doc.id, data});
          } else {
            otherVideos.push({doc, videoId: doc.id, data});
          }
        }

        // 5. 并发查询所有 processing 视频的状态（性能优化）
        const processingVideoUpdates = new Map<string, {
        videoUrl: string | null;
        status: string;
        progress: number | null;
        errorCode: string | null;
        errorMessage: string | null;
        errorDetail: string | null;
      }>();

        if (processingVideos.length > 0) {
          functions.logger.info(
            `🔄 并发查询 ${processingVideos.length} 个 processing 视频的状态`
          );

          const statusPromises = processingVideos.map(
            async ({doc, videoId, data: videoData}) => {
              try {
                if (!config) {
                  return null;
                }

                const heygenApiUrl =
                `${config.heygenApiBaseUrl}/v1/video_status.get?` +
                `video_id=${videoId}`;

                // 添加超时控制（每个请求最多 3 秒）
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(heygenApiUrl, {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": config.heygenApiKey,
                  },
                  signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                  const result = await response.json() as {
                  code?: number;
                  data?: {
                    status?: string;
                    video_url?: string;
                    progress?: number;
                    error?: {
                      code?: string;
                      message?: string;
                      detail?: string;
                    };
                  };
                };

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dataObj: any = result.data || result;

                  if (dataObj) {
                    const latestStatus = dataObj.status || videoData.status;
                    const videoUrl = dataObj.video_url ||
                    dataObj.url ||
                    videoData.video_url ||
                    null;
                    let progress: number | null = null;
                    if (dataObj.progress !== undefined) {
                      progress = typeof dataObj.progress === "number" ?
                        dataObj.progress : null;
                    }

                    const errorCode = dataObj.error?.code ||
                    videoData.error_code ||
                    null;
                    const errorMessage = dataObj.error?.message ||
                    videoData.error_message ||
                    null;
                    const errorDetail = dataObj.error?.detail ||
                    videoData.error_detail ||
                    null;

                    // 保存更新信息
                    processingVideoUpdates.set(videoId, {
                      videoUrl,
                      status: latestStatus,
                      progress,
                      errorCode,
                      errorMessage,
                      errorDetail,
                    });

                    // 更新 Firestore（异步，不阻塞返回）
                    doc.ref.update({
                      status: latestStatus,
                      video_url: videoUrl,
                      progress: progress,
                      error_code: errorCode,
                      error_message: errorMessage,
                      error_detail: errorDetail,
                      updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    }).catch((err) => {
                      functions.logger.warn(
                        `更新视频 ${videoId} 状态失败:`,
                        err
                      );
                    });
                  }
                }
              } catch (error) {
              // 超时或错误，使用 Firestore 中的数据
                if (error instanceof Error && error.name === "AbortError") {
                  functions.logger.warn(
                    `⏱️ 查询视频 ${videoId} 超时（3秒），使用 Firestore 数据`
                  );
                } else {
                  functions.logger.warn(
                    `查询视频 ${videoId} 状态失败:`,
                    error
                  );
                }
              }
              return null;
            }
          );

          // 等待所有查询完成，但最多等待 5 秒
          await Promise.race([
            Promise.all(statusPromises),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        }

        // 6. 构建视频列表（保持与原来完全相同的数据结构）
        for (const {videoId, data} of processingVideos) {
          const update = processingVideoUpdates.get(videoId);
          const status = update?.status || data.status || "unknown";
          const videoUrl = update?.videoUrl ?? data.video_url ?? null;
          const progress = update?.progress ??
          (data.progress !== undefined ?
            (typeof data.progress === "number" ? data.progress : null) :
            null);
          const errorCode = update?.errorCode ?? data.error_code ?? null;
          const errorMessage =
            update?.errorMessage ?? data.error_message ?? null;
          const errorDetail = update?.errorDetail ?? data.error_detail ?? null;

          videos.push({
            video_id: videoId,
            video_url: videoUrl,
            status: status,
            progress: progress,
            image_url: data.image_url || null,
            script: data.script || null,
            avatar_id: data.avatar_id || null,
            voice_id: data.voice_id || null,
            error_code: errorCode,
            error_message: errorMessage,
            error_detail: errorDetail,
            created_at:
            data.created_at?.toDate?.()?.toISOString() || null,
            updated_at:
            data.updated_at?.toDate?.()?.toISOString() || null,
          });
        }

        // 处理其他视频
        for (const {videoId, data} of otherVideos) {
          let progress: number | null = null;
          if (data.progress !== undefined) {
            progress = typeof data.progress === "number" ? data.progress : null;
          }

          videos.push({
            video_id: videoId,
            video_url: data.video_url || null,
            status: data.status || "unknown",
            progress: progress,
            image_url: data.image_url || null,
            script: data.script || null,
            avatar_id: data.avatar_id || null,
            voice_id: data.voice_id || null,
            error_code: data.error_code || null,
            error_message: data.error_message || null,
            error_detail: data.error_detail || null,
            created_at:
            data.created_at?.toDate?.()?.toISOString() || null,
            updated_at:
            data.updated_at?.toDate?.()?.toISOString() || null,
          });
        }

        // 7. 按创建时间排序（降序）并限制数量
        videos.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA; // 降序
        });

        // 限制最多返回 100 条
        const limitedVideos = videos.slice(0, 100);

        functions.logger.info(
          `✅ 获取用户视频列表 (用户: ${uid}, 数量: ${limitedVideos.length})`
        );

        return {
          success: true,
          videos: limitedVideos,
          count: limitedVideos.length,
        };
      } catch (error: unknown) {
        functions.logger.error(
          `❌ 获取用户视频列表失败 (用户: ${uid}):`,
          error
        );

        const errorMessage =
        error instanceof Error ? error.message : String(error);
        throw new functions.https.HttpsError(
          "internal",
          `Failed to get user videos: ${errorMessage}`
        );
      }
    }
  );

