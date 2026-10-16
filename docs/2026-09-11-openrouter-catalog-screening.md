# Screening katalog OpenRouter -- 11 Sep 2026 (live, read-only)

Sumber: /models (437), /images/models (52), /videos/models (29). Harga USD per 1 juta token (prompt/completion). Varian :free dan :batch dikeluarkan dari kandidat chat (free = rate-limit/tidak stabil; batch = asinkron). Kualitas TIDAK terbaca dari katalog -- tier akhir dipilih komando [PERKIRAAN].

## 1. TEKS -- 40 termurah, ctx >= 64k
| Model | in $/M | out $/M | ctx | JSON | reasoning | in-modalities |
|---|---|---|---|---|---|---|
| ibm-granite/granite-4.0-h-micro | 0.017 | 0.112 | 131000 | ya | - | text |
| mistralai/mistral-nemo | 0.019 | 0.030 | 131072 | ya | - | text |
| inclusionai/ling-3.0-flash | 0.021 | 0.063 | 262144 | ya | ya | text |
| qwen/qwen3.7-flash | 0.030 | 0.130 | 1000000 | ya | ya | text,image,video |
| openai/gpt-oss-20b | 0.030 | 0.130 | 131072 | ya | ya | text |
| amazon/nova-micro-v1 | 0.035 | 0.140 | 128000 | - | - | text |
| openai/gpt-oss-120b | 0.037 | 0.170 | 131072 | ya | ya | text |
| cohere/command-r7b-12-2024 | 0.037 | 0.150 | 128000 | ya | - | text |
| inception/mercury-2.5 | 0.040 | 0.150 | 260000 | ya | ya | text |
| ~deepseek/deepseek-v4-flash-latest | 0.040 | 0.160 | 1310720 | ya | ya | text |
| google/gemma-4-26b-a4b-it | 0.042 | 0.220 | 1000000 | ya | ya | image,text,video |
| nvidia/nemotron-3-nano-30b-a3b | 0.050 | 0.200 | 262144 | ya | ya | text |
| openai/gpt-5-nano | 0.050 | 0.400 | 400000 | ya | ya | text,image,file |
| google/gemma-3-4b-it | 0.050 | 0.100 | 131072 | ya | - | text,image |
| google/gemma-3-12b-it | 0.050 | 0.150 | 131072 | ya | - | text,image |
| meta-llama/llama-3.2-3b-instruct | 0.050 | 0.330 | 131072 | - | - | text |
| meta-llama/llama-3.1-8b-instruct | 0.050 | 0.080 | 131072 | ya | - | text |
| ibm-granite/granite-4.2-8b | 0.060 | 0.250 | 131072 | ya | ya | text |
| inclusionai/ling-3.0-flash-fin | 0.060 | 0.180 | 262144 | ya | ya | text |
| poolside/laguna-xs-2.1 | 0.060 | 0.120 | 262144 | - | ya | text |
| amazon/nova-lite-v1 | 0.060 | 0.240 | 300000 | - | - | text,image |
| z-ai/glm-4.7-flash | 0.061 | 0.400 | 200000 | ya | ya | text |
| deepseek/deepseek-v4-flash-0731 | 0.065 | 0.180 | 1310720 | ya | ya | text |
| qwen/qwen3.5-flash-02-23 | 0.065 | 0.260 | 1000000 | ya | ya | text,image,video |
| qwen/qwen3-coder-30b-a3b-instruct | 0.070 | 0.280 | 262144 | ya | - | text |
| ~z-ai/glm-flash-latest | 0.075 | 0.250 | 1310720 | ya | ya | text,image,video |
| bytedance-seed/seed-1.6-flash | 0.075 | 0.300 | 262144 | ya | ya | image,text,video |
| openai/gpt-oss-safeguard-20b | 0.075 | 0.300 | 131072 | ya | ya | text |
| mistralai/mistral-small-3.2-24b-instruct | 0.075 | 0.200 | 131072 | ya | - | image,text |
| nvidia/nemotron-3.5-lightning | 0.080 | 0.200 | 262144 | ya | ya | text |
| qwen/qwen3-32b | 0.080 | 0.280 | 131072 | ya | ya | text |
| google/gemma-3-27b-it | 0.080 | 0.450 | 131072 | ya | - | text,image |
| nvidia/nemotron-3-super-120b-a12b | 0.085 | 0.400 | 262144 | ya | ya | text |
| deepseek/deepseek-v4-flash | 0.089 | 0.177 | 1048576 | ya | ya | text |
| upstage/solar-pro4 | 0.090 | 0.360 | 524288 | ya | ya | text |
| poolside/laguna-s-2.1 | 0.090 | 0.180 | 1048576 | - | ya | text |
| google/gemma-4-31b-it | 0.090 | 0.340 | 262144 | ya | ya | image,text,video |
| qwen/qwen3-next-80b-a3b-instruct | 0.090 | 1.100 | 262144 | ya | - | text |
| qwen/qwen3-30b-a3b-instruct-2507 | 0.090 | 0.300 | 262144 | ya | - | text |
| meta/muse-spark-1.3-contributor | 0.100 | 0.200 | 1048576 | ya | ya | text,image,video,file,audio |

## 2. TEKS -- kandidat SANTAI (prompt <= $0.10/M, ctx >= 128k, JSON)
| Model | in $/M | out $/M | ctx | JSON | reasoning | in-modalities |
|---|---|---|---|---|---|---|
| ibm-granite/granite-4.0-h-micro | 0.017 | 0.112 | 131000 | ya | - | text |
| mistralai/mistral-nemo | 0.019 | 0.030 | 131072 | ya | - | text |
| inclusionai/ling-3.0-flash | 0.021 | 0.063 | 262144 | ya | ya | text |
| qwen/qwen3.7-flash | 0.030 | 0.130 | 1000000 | ya | ya | text,image,video |
| openai/gpt-oss-20b | 0.030 | 0.130 | 131072 | ya | ya | text |
| openai/gpt-oss-120b | 0.037 | 0.170 | 131072 | ya | ya | text |
| cohere/command-r7b-12-2024 | 0.037 | 0.150 | 128000 | ya | - | text |
| inception/mercury-2.5 | 0.040 | 0.150 | 260000 | ya | ya | text |
| ~deepseek/deepseek-v4-flash-latest | 0.040 | 0.160 | 1310720 | ya | ya | text |
| google/gemma-4-26b-a4b-it | 0.042 | 0.220 | 1000000 | ya | ya | image,text,video |
| nvidia/nemotron-3-nano-30b-a3b | 0.050 | 0.200 | 262144 | ya | ya | text |
| openai/gpt-5-nano | 0.050 | 0.400 | 400000 | ya | ya | text,image,file |
| google/gemma-3-4b-it | 0.050 | 0.100 | 131072 | ya | - | text,image |
| google/gemma-3-12b-it | 0.050 | 0.150 | 131072 | ya | - | text,image |
| meta-llama/llama-3.1-8b-instruct | 0.050 | 0.080 | 131072 | ya | - | text |
| ibm-granite/granite-4.2-8b | 0.060 | 0.250 | 131072 | ya | ya | text |
| inclusionai/ling-3.0-flash-fin | 0.060 | 0.180 | 262144 | ya | ya | text |
| z-ai/glm-4.7-flash | 0.061 | 0.400 | 200000 | ya | ya | text |
| deepseek/deepseek-v4-flash-0731 | 0.065 | 0.180 | 1310720 | ya | ya | text |
| qwen/qwen3.5-flash-02-23 | 0.065 | 0.260 | 1000000 | ya | ya | text,image,video |
| qwen/qwen3-coder-30b-a3b-instruct | 0.070 | 0.280 | 262144 | ya | - | text |
| ~z-ai/glm-flash-latest | 0.075 | 0.250 | 1310720 | ya | ya | text,image,video |
| bytedance-seed/seed-1.6-flash | 0.075 | 0.300 | 262144 | ya | ya | image,text,video |
| openai/gpt-oss-safeguard-20b | 0.075 | 0.300 | 131072 | ya | ya | text |
| mistralai/mistral-small-3.2-24b-instruct | 0.075 | 0.200 | 131072 | ya | - | image,text |
| nvidia/nemotron-3.5-lightning | 0.080 | 0.200 | 262144 | ya | ya | text |
| qwen/qwen3-32b | 0.080 | 0.280 | 131072 | ya | ya | text |
| google/gemma-3-27b-it | 0.080 | 0.450 | 131072 | ya | - | text,image |
| nvidia/nemotron-3-super-120b-a12b | 0.085 | 0.400 | 262144 | ya | ya | text |
| deepseek/deepseek-v4-flash | 0.089 | 0.177 | 1048576 | ya | ya | text |

## 3. TEKS -- kandidat SERIUS ($0.5-$2/M, reasoning, ctx >= 128k)
| Model | in $/M | out $/M | ctx | JSON | reasoning | in-modalities |
|---|---|---|---|---|---|---|
| bytedance-seed/seed-2-1-turbo | 0.500 | 2.500 | 262144 | ya | ya | text,image,video |
| bytedance-seed/seed-2.0-code | 0.500 | 3.000 | 262144 | ya | ya | text,image,video |
| google/gemini-3.1-flash-image | 0.500 | 3.000 | 131072 | ya | ya | image,text |
| google/gemini-3-flash-preview | 0.500 | 3.000 | 1048576 | ya | ya | text,image,file,audio,video |
| deepseek/deepseek-r1-0528 | 0.500 | 2.150 | 163840 | ya | ya | text |
| qwen/qwen3.5-397b-a17b | 0.550 | 3.500 | 262144 | ya | ya | text,image,video |
| minimax/minimax-m1 | 0.550 | 2.200 | 1000000 | - | ya | text |
| z-ai/glm-5 | 0.600 | 1.920 | 204800 | ya | ya | text |
| moonshotai/kimi-k2-thinking | 0.600 | 2.500 | 262144 | ya | ya | text |
| z-ai/glm-4.5 | 0.600 | 2.200 | 131072 | ya | ya | text |
| nvidia/nemotron-3-ultra-550b-a55b | 0.625 | 3.125 | 262144 | ya | ya | text |
| qwen/qwen3-coder-plus | 0.650 | 3.250 | 1000000 | ya | ya | text |
| aion-labs/aion-3.0-mini | 0.700 | 1.400 | 131072 | ya | ya | text |
| moonshotai/kimi-k2.7-code | 0.710 | 3.500 | 262144 | ya | ya | text,image |
| google/gemini-3.8-flash | 0.750 | 3.750 | 1048576 | ya | ya | text,image,video,file,audio |
| google/gemini-3.7-flash | 0.750 | 3.750 | 1048576 | ya | ya | text,image,video,file,audio |
| google/gemini-3.6-flash | 0.750 | 3.750 | 1048576 | ya | ya | text,image,video,file,audio |
| ~openai/gpt-mini-latest | 0.750 | 4.500 | 400000 | ya | ya | file,image,text |
| ~google/gemini-flash-latest | 0.750 | 3.750 | 1048576 | ya | ya | text,image,video,file,audio |
| openai/gpt-5.4-mini | 0.750 | 4.500 | 400000 | ya | ya | file,image,text |
| qwen/qwen3-max-thinking | 0.780 | 3.900 | 262144 | ya | ya | text |
| qwen/qwen3-max | 0.780 | 3.900 | 262144 | ya | ya | text |
| aion-labs/aion-2.0 | 0.800 | 1.600 | 131072 | ya | ya | text |
| tencent/hy4-preview | 0.834 | 2.501 | 1048576 | ya | ya | text |
| sakana/sakana-namazu | 0.950 | 4.000 | 262144 | - | ya | text,image,file |
| moonshotai/kimi-k2.6 | 0.950 | 4.000 | 262144 | ya | ya | text,image |
| deepseek/deepseek-v4-pro | 0.955 | 1.911 | 1048576 | ya | ya | text |
| z-ai/glm-5.2 | 0.966 | 3.036 | 1048576 | ya | ya | text |
| z-ai/glm-5.1 | 0.966 | 3.036 | 204800 | ya | ya | text |
| ~z-ai/glm-latest | 1.000 | 3.410 | 1310720 | ya | ya | text |

## 4. VISION (input image) termurah, ctx >= 64k
| Model | in $/M | out $/M | ctx | JSON | reasoning | in-modalities |
|---|---|---|---|---|---|---|
| qwen/qwen3.7-flash | 0.030 | 0.130 | 1000000 | ya | ya | text,image,video |
| google/gemma-4-26b-a4b-it | 0.042 | 0.220 | 1000000 | ya | ya | image,text,video |
| openai/gpt-5-nano | 0.050 | 0.400 | 400000 | ya | ya | text,image,file |
| google/gemma-3-4b-it | 0.050 | 0.100 | 131072 | ya | - | text,image |
| google/gemma-3-12b-it | 0.050 | 0.150 | 131072 | ya | - | text,image |
| amazon/nova-lite-v1 | 0.060 | 0.240 | 300000 | - | - | text,image |
| qwen/qwen3.5-flash-02-23 | 0.065 | 0.260 | 1000000 | ya | ya | text,image,video |
| ~z-ai/glm-flash-latest | 0.075 | 0.250 | 1310720 | ya | ya | text,image,video |
| bytedance-seed/seed-1.6-flash | 0.075 | 0.300 | 262144 | ya | ya | image,text,video |
| mistralai/mistral-small-3.2-24b-instruct | 0.075 | 0.200 | 131072 | ya | - | image,text |
| google/gemma-3-27b-it | 0.080 | 0.450 | 131072 | ya | - | text,image |
| google/gemma-4-31b-it | 0.090 | 0.340 | 262144 | ya | ya | image,text,video |
| meta/muse-spark-1.3-contributor | 0.100 | 0.200 | 1048576 | ya | ya | text,image,video,file,audio |
| meta/muse-spark-1.2-contributor | 0.100 | 0.200 | 1048576 | ya | ya | text,image,video,file,audio |
| qwen/qwen3.6-35b-a3b | 0.100 | 0.900 | 262144 | ya | ya | text,image,video |
| qwen/qwen3.5-9b | 0.100 | 0.150 | 262144 | ya | ya | text,image,video |
| bytedance-seed/seed-2.0-mini | 0.100 | 0.400 | 262144 | ya | ya | text,image,video |
| mistralai/ministral-3b-2512 | 0.100 | 0.100 | 131072 | ya | - | text,image |
| bytedance/ui-tars-1.5-7b | 0.100 | 0.200 | 128000 | - | - | image,text |
| google/gemini-2.5-flash-lite | 0.100 | 0.400 | 1048576 | ya | ya | text,image,file,audio,video |

## 5. EMBEDDINGS
| Model | in $/M | ctx |
|---|---|---|

## 6. SPEECH (TTS)
| Model | in $/M | out $/M | pricing mentah |
|---|---|---|---|

## 7. TRANSCRIPTION / input audio
| Model | in $/M | out $/M | in | out |
|---|---|---|---|---|
| openrouter/auto-beta | -1000000.000 | -1000000.000 | text,image,audio,file,video | text,image |
| openrouter/auto | -1000000.000 | -1000000.000 | text,image,audio,file,video | text,image |
| google/gemini-2.5-flash-lite:batch | 0.050 | 0.200 | text,image,file,audio,video | text |
| meta/muse-spark-1.3-contributor | 0.100 | 0.200 | text,image,video,file,audio | text |
| meta/muse-spark-1.2-contributor | 0.100 | 0.200 | text,image,video,file,audio | text |
| mistralai/voxtral-small-24b-2507 | 0.100 | 0.300 | text,audio,file | text |
| google/gemini-2.5-flash-lite | 0.100 | 0.400 | text,image,file,audio,video | text |
| google/gemini-3.1-flash-lite:batch | 0.125 | 0.750 | text,image,video,file,audio | text |
| xiaomi/mimo-v2.5 | 0.140 | 0.280 | text,audio,image,video | text |
| google/gemini-3.5-flash-lite:batch | 0.150 | 1.250 | text,image,video,file,audio | text |
| google/gemini-2.5-flash:batch | 0.150 | 1.250 | file,image,text,audio,video | text |
| google/gemini-3.1-flash-lite | 0.250 | 1.500 | text,image,video,file,audio | text |
| google/gemini-3.1-flash-lite-preview | 0.250 | 1.500 | text,image,video,file,audio | text |
| google/gemini-3-flash-preview:batch | 0.250 | 1.500 | text,image,file,audio,video | text |
| google/gemini-3.5-flash-lite | 0.300 | 2.500 | text,image,video,file,audio | text |
| google/gemini-2.5-flash | 0.300 | 2.500 | file,image,text,audio,video | text |
| google/gemini-3.8-flash:batch | 0.375 | 1.875 | text,image,video,file,audio | text |
| google/gemini-3.7-flash:batch | 0.375 | 1.875 | text,image,video,file,audio | text |
| google/gemini-3.6-flash:batch | 0.375 | 1.875 | text,image,video,file,audio | text |
| thinkingmachines/inkling-small | 0.450 | 1.200 | text,image,audio | text |

## 8. IMAGE GENERATION (/images/models) -- harga per gambar hanya di /endpoints per model
| Model | aspect ratios | resolutions | qualities | ref-image |
|---|---|---|---|---|
| openai/gpt-image-2.5-sunburst | 9 |  | auto/low/medium/high/xhigh/max | ya |
| openai/gpt-image-2.5-flare | 9 |  | auto/low/medium/high/xhigh/max | ya |
| microsoft/mai-image-2.6 | 8 |  |  | ya |
| microsoft/mai-image-2.6-flash | 8 |  |  | ya |
| meta/muse-image | 0 |  |  | - |
| recraft/recraft-v4-styles-pro | 12 |  |  | ya |
| recraft/recraft-v4-styles-vector | 12 |  |  | ya |
| recraft/recraft-v4-styles-pro-vector | 12 |  |  | ya |
| recraft/recraft-v4-styles | 12 |  |  | ya |
| bytedance-seed/seedream-5-0-lite | 18 | 2K/4K |  | ya |
| bytedance-seed/seedream-5-0-pro | 18 | 1K/2K |  | ya |
| x-ai/grok-imagine-image-2.0 | 14 | 1K/2K | low/medium | ya |
| qwen/qwen-image-3-pro | 13 | 1K/2K |  | ya |
| qwen/qwen-image-3 | 13 | 1K/2K |  | ya |
| microsoft/mai-image-2.5-pro | 8 |  |  | ya |
| krea/krea-2-large | 7 | 1K |  | ya |
| krea/krea-2-medium | 7 | 1K |  | ya |
| krea/krea-2-medium-turbo | 7 | 1K |  | ya |
| google/gemini-3.1-flash-lite-image | 14 | 1K |  | ya |
| openai/gpt-image-2 | 9 |  | auto/low/medium/high | ya |
| openai/gpt-image-1-mini | 4 |  | auto/low/medium/high | ya |
| openai/gpt-image-1 | 4 |  | auto/low/medium/high | ya |
| google/gemini-3.1-flash-image | 14 | 512/1K/2K/4K |  | ya |
| google/gemini-3-pro-image | 10 | 1K/2K/4K |  | ya |
| sourceful/riverflow-v2.5-pro | 9 | 1K/2K/4K |  | ya |
| sourceful/riverflow-v2.5-fast | 9 | 1K/2K |  | ya |
| microsoft/mai-image-2.5 | 8 |  |  | ya |
| x-ai/grok-imagine-image-quality | 14 | 1K/2K |  | ya |
| recraft/recraft-v4.1-pro-vector | 6 |  |  | ya |
| recraft/recraft-v4.1-vector | 6 |  |  | ya |
| recraft/recraft-v4.1-utility-pro | 6 |  |  | ya |
| recraft/recraft-v4.1-utility | 6 |  |  | ya |
| recraft/recraft-v4.1-pro | 6 |  |  | ya |
| recraft/recraft-v4.1 | 6 |  |  | ya |
| recraft/recraft-v4-pro-vector | 6 |  |  | ya |
| recraft/recraft-v4-vector | 6 |  |  | ya |
| recraft/recraft-v4-pro | 6 |  |  | ya |
| recraft/recraft-v4 | 6 |  |  | ya |
| recraft/recraft-v3 | 6 |  |  | ya |
| openai/gpt-5.4-image-2 | 9 |  | auto/low/medium/high | ya |

## 9. VIDEO GENERATION (/videos/models)
| Model | durasi | resolusi | sku pertama | USD |
|---|---|---|---|---|
| black-forest-labs/flux-video-edit |  |  | cents_per_second_output | 3 |
| minimax/hailuo-3-max | 5/6/7/8/9/10/11/12/13/14/15 | 768p/480p | duration_seconds | 0.08 |
| alibaba/wan-3.0-prime | 2/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17/18/19/20/21/22/23/24/25/26/27/28/29/30 | 480p/720p/1080p | duration_seconds_480p | 0.068 |
| alibaba/wan-3.0 | 2/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17/18/19/20/21/22/23/24/25/26/27/28/29/30 | 480p/720p/1080p | duration_seconds_480p | 0.05 |
| heygen/avatar-iv |  | 720p/1080p | duration_seconds | 0.05 |
| black-forest-labs/flux-video-upscale |  |  | cents_per_megapixel_second_precise | 7.5 |
| bytedance/seedance-2.0-mini | 4/5/6/7/8/9/10/11/12/13/14/15 | 480p/720p | video_tokens | 0.0000035 |
| bytedance/seedance-2.5 | 4/5/6/7/8/9/10/11/12/13/14/15/16/17/18/19/20/21/22/23/24/25/26/27/28/29/30 | 480p/720p | video_tokens | 0.0000107 |
| black-forest-labs/flux-3-video | 5/6/7/8/9/10/11/12/13/14/15/16/17/18/19/20 | 720p/1080p | cents_per_second_output | 17 |
| minimax/hailuo-3 | 5/6/7/8/9/10/11/12/13/14/15 | 2K | duration_seconds | 0.13 |
| runway/aleph-2 |  |  | cents_per_second_output | 28 |
| runway/gen-4.5 | 2/3/4/5/6/7/8/9/10 | 720p | cents_per_second_output | 12 |
| x-ai/grok-imagine-video-1.5 | 1/2/3/4/5/6/7/8/9/10/11/12/13/14/15 | 480p/720p/1080p | cents_per_image_input | 1 |
| alibaba/happyhorse-1.1 | 3/4/5/6/7/8/9/10/11/12/13/14/15 | 720p/1080p | duration_seconds_720p | 0.0988 |
| alibaba/happyhorse-1.0 | 3/4/5/6/7/8/9/10/11/12/13/14/15 | 720p/1080p | duration_seconds_720p | 0.0988 |
| x-ai/grok-imagine-video | 1/2/3/4/5/6/7/8/9/10/11/12/13/14/15 | 480p/720p | cents_per_image_input | 0.2 |
| kwaivgi/kling-v3.0-pro | 3/4/5/6/7/8/9/10/11/12/13/14/15 | 720p | duration_seconds | 0.112 |
| kwaivgi/kling-v3.0-std | 3/4/5/6/7/8/9/10/11/12/13/14/15 | 720p | duration_seconds | 0.084 |
| google/veo-3.1-fast | 4/6/8 | 720p/1080p/4K | duration_seconds_with_audio | 0.12 |
| google/veo-3.1-lite | 8/4/6 | 720p/1080p | duration_seconds_with_audio | 0.08 |
| kwaivgi/kling-video-o1 | 5/10 | 720p | duration_seconds | 0.1120 |
| minimax/hailuo-2.3 | 6/10 | 1080p | duration_seconds | 0.0817 |
| bytedance/seedance-2.0-fast | 4/5/6/7/8/9/10/11/12/13/14/15 | 480p/720p | video_tokens | 0.0000042 |
| alibaba/wan-2.7 | 2/3/4/5/6/7/8/9/10 | 720p/1080p | duration_seconds | 0.1 |
| bytedance/seedance-2.0 | 4/5/6/7/8/9/10/11/12/13/14/15 | 480p/720p/1080p/4K | video_tokens | 0.000007 |
| alibaba/wan-2.6 | 5/10 | 720p/1080p | text_to_video_duration_seconds_480p | 0.04 |
| bytedance/seedance-1-5-pro | 4/5/6/7/8/9/10/11/12 | 480p/720p/1080p | video_tokens | 0.0000024 |
| openai/sora-2-pro | 4/8/12/16/20 | 720p/1080p | duration_seconds_720p | 0.30 |
| google/veo-3.1 | 4/6/8 | 720p/1080p/4K | duration_seconds_with_audio | 0.40 |

## 10. Diskon / varian
- :batch = lebih murah tetapi asinkron (job), bukan untuk chat; kandidat kerja latar (brief/insight) di masa depan.
- :free = gratis, rate-limit ketat, bisa hilang. Tidak untuk produk.
- Varian :free: 19, :batch: 77