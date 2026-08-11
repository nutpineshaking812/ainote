# --- 第一阶段：构建阶段 (Builder) ---
# 使用官方 pgvector 镜像作为构建底座，确保 pgvector 相关的开发环境最纯净
FROM pgvector/pgvector:pg16 AS builder

# 替换为阿里云镜像源
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

# 安装构建工具、wget 和 bzip2
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-server-dev-16 \
    git \
    bison \
    flex \
    make \
    ca-certificates \
    wget \
    bzip2 \
    binutils && \
    rm -rf /var/lib/apt/lists/*

# 1. 编译安装 Apache AGE
WORKDIR /tmp/age
RUN git clone -b PG16 https://github.com/apache/age.git . && \
    make install

# 2. 编译安装 SCWS (zhparser 依赖)
WORKDIR /tmp/scws
RUN wget -q -O - http://www.xunsearch.com/scws/down/scws-1.2.3.tar.bz2 | tar xjf - && \
    cd scws-1.2.3 && \
    ./configure && \
    make install

# 3. 编译安装 zhparser
WORKDIR /tmp/zhparser
RUN wget --quiet --tries=5 --timeout=20 -O zhparser.tar.gz https://github.com/amutu/zhparser/archive/refs/heads/master.tar.gz && \
    tar xzf zhparser.tar.gz --strip-components=1 && \
    make && \
    make install

# --- 第二阶段：运行阶段 (Final) ---
# 【关键】直接使用官方 pgvector 镜像作为底座，彻底解决非法指令问题
FROM pgvector/pgvector:pg16

# 从 builder 阶段拷贝我们额外编译的扩展
# Apache AGE
COPY --from=builder /usr/lib/postgresql/16/lib/age.so /usr/lib/postgresql/16/lib/
COPY --from=builder /usr/share/postgresql/16/extension/age* /usr/share/postgresql/16/extension/

# zhparser & SCWS
COPY --from=builder /usr/local/lib/libscws* /usr/local/lib/
COPY --from=builder /usr/lib/postgresql/16/lib/zhparser.so /usr/lib/postgresql/16/lib/
COPY --from=builder /usr/share/postgresql/16/extension/zhparser* /usr/share/postgresql/16/extension/

# 替换为阿里云镜像源（运行阶段）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

# 运行阶段极简清理
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget bzip2 && \
    # 下载并安装 zhparser 需要的中文分词字典
    wget --quiet http://www.xunsearch.com/scws/down/scws-dict-chs-utf8.tar.bz2 && \
    tar xjf scws-dict-chs-utf8.tar.bz2 && \
    cp dict.utf8.xdb /usr/share/postgresql/16/tsearch_data/ && \
    # 清理
    ldconfig && \
    rm -rf /var/lib/apt/lists/* scws-dict-chs-utf8.tar.bz2 dict.utf8.xdb
