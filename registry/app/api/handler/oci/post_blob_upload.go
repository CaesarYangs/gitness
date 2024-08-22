//  Copyright 2023 Harness, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package oci

import (
	"net/http"
	"strings"

	"github.com/harness/gitness/registry/app/pkg/commons"
)

func (h *Handler) InitiateUploadBlob(w http.ResponseWriter, r *http.Request) {
	info, err := h.getRegistryInfo(r, false)
	if err != nil {
		handleErrors(r.Context(), []error{err}, w)
		return
	}
	fromParam := r.FormValue("from")
	fromParamParts := strings.Split(fromParam, "/")
	fromRepo := ""
	if len(fromParamParts) > 1 {
		fromRepo = fromParamParts[1]
	}
	mountDigest := r.FormValue("mount")
	headers, errs := h.Controller.InitiateUploadBlob(r.Context(), info, fromRepo, mountDigest)
	if commons.IsEmpty(errs) {
		headers.WriteToResponse(w)
	}
	handleErrors(r.Context(), errs, w)
}
