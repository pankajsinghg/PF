import { useState } from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  History,
  LayoutDashboard,
  RefreshCw,
  Repeat,
  Send,
  SquarePen,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePRDetails } from "../../hooks/usePRDetails";

import axiosClient from "../../api/axiosClient";

import ApprovalActionDialog from "../../components/pr/ApprovalActionDialog";

import {
  processPRApprovalAction,
  PR_APPROVAL_ACTIONS,
  resubmitSentBackPR,
  submitDraftPR,
} from "../../services/prService";

const PENDING_APPROVAL_STATUSES = [
  1,
  2,
  3,
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const dateTime = String(value)
    .replace("T", " ")
    .replace("Z", "");

  const [
    datePart,
    timePart = "",
  ] = dateTime.split(" ");

  const [
    year,
    month,
    day,
  ] = datePart.split("-");

  const time = timePart
    .split(".")[0]
    .substring(0, 8);

  if (
    !year ||
    !month ||
    !day ||
    !time
  ) {
    return "-";
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthName =
    monthNames[
      Number(month) - 1
    ];

  if (!monthName) {
    return "-";
  }

  return (
    `${day} ${monthName} ${year}, ` +
    `${time}`
  );
};

const getStatusClass = (statusId) => {
  const normalizedStatusId =
    Number(statusId);

  if (normalizedStatusId === 0) {
    return "status-draft";
  }

  if (
    [1, 2, 3].includes(
      normalizedStatusId,
    )
  ) {
    return "status-pending";
  }

  if (normalizedStatusId === 4) {
    return "status-sent-back";
  }

  if (
    [5, 6, 7].includes(
      normalizedStatusId,
    )
  ) {
    return "status-rejected";
  }

  if (normalizedStatusId === 8) {
    return "status-approved";
  }

  return "status-default";
};

const getBackendOrigin = () => {
  const baseURL =
    axiosClient.defaults.baseURL;

  if (!baseURL) {
    throw new Error(
      "API base URL is not configured",
    );
  }

  try {
    const absoluteURL = new URL(
      baseURL,
      window.location.origin,
    );

    return absoluteURL.origin;
  } catch {
    throw new Error(
      "Invalid API base URL configuration",
    );
  }
};

const resolveAttachmentUrl = (
  filePath,
) => {
  if (
    !filePath ||
    typeof filePath !== "string"
  ) {
    return "";
  }

  const trimmedPath =
    filePath.trim();

  if (
    trimmedPath.startsWith(
      "http://",
    ) ||
    trimmedPath.startsWith(
      "https://",
    )
  ) {
    return trimmedPath;
  }

  const normalizedPath =
    trimmedPath.startsWith("/")
      ? trimmedPath
      : `/${trimmedPath}`;

  try {
    return (
      `${getBackendOrigin()}` +
      `${normalizedPath}`
    );
  } catch (urlError) {
    console.error(
      "Unable to resolve attachment URL:",
      urlError,
    );

    return "";
  }
};

export default function PRDetailsPage({
  approvalMode = false,
}) {
  const { prId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();

  const {
    prDetails,
    loading,
    error,
    refresh,
  } = usePRDetails(prId);

  const [
    historyExpanded,
    setHistoryExpanded,
  ] = useState(false);

  const [
    selectedAction,
    setSelectedAction,
  ] = useState(null);

  const [
    actionProcessing,
    setActionProcessing,
  ] = useState(false);

  const [
    actionSuccess,
    setActionSuccess,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState("");

  const [
    requestorActionProcessing,
    setRequestorActionProcessing,
  ] = useState(false);

  const [
    requestorActionMessage,
    setRequestorActionMessage,
  ] = useState("");

  const [
    requestorActionError,
    setRequestorActionError,
  ] = useState("");

  const defaultReturnTo = approvalMode
    ? "/approvals"
    : "/purchase-requisitions";

  const defaultReturnLabel = approvalMode
    ? "Back to Pending Approvals"
    : "Back to Dashboard";

  const returnTo =
    location.state?.returnTo ||
    defaultReturnTo;

  const returnLabel =
    location.state?.returnLabel ||
    defaultReturnLabel;

  const returningToHistory =
    returnTo ===
    "/approvals/history";

  const currentEmployeeId =
    Number(user?.empId);

  const hasAuthenticatedEmployee =
    Number.isInteger(
      currentEmployeeId,
    ) &&
    currentEmployeeId > 0;

  const handleOpenAttachment = (
    attachmentUrl,
  ) => {
    if (!attachmentUrl) {
      return;
    }

    const openedWindow =
      window.open(
        attachmentUrl,
        "_blank",
        "noopener,noreferrer",
      );

    if (openedWindow) {
      openedWindow.opener = null;
      openedWindow.focus();

      return;
    }

    window.location.assign(
      attachmentUrl,
    );
  };

  if (loading) {
    return (
      <main className="pr-details-page">
        <section
          className="dashboard-state"
          role="status"
        >
          Loading Purchase Requisition...
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pr-details-page">
        <section className="details-error-card">
          <h1>
            Unable to load PR
          </h1>

          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>

          <div className="details-page-actions">
            <button
              type="button"
              className={
                "secondary-button " +
                "button-with-icon"
              }
              onClick={() =>
                navigate(returnTo)
              }
            >
              {returningToHistory ? (
                <History
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : (
                <LayoutDashboard
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}

              <span>
                {returnLabel}
              </span>
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={refresh}
            >
              Try Again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!prDetails?.header) {
    return (
      <main className="pr-details-page">
        <section className="dashboard-state">
          Purchase Requisition not found.
        </section>
      </main>
    );
  }

  const {
    header,
    lines = [],
    attachments = [],
    history = [],
  } = prDetails;

  const requestorId =
    Number(
      header.requestorId,
    );

  const pendingWithEmployeeId =
    Number(
      header.pendingWithEmpId,
    );

  const currentStatus =
    Number(
      header.currentStatus,
    );

  const isRequestor =
    hasAuthenticatedEmployee &&
    requestorId ===
      currentEmployeeId;

  const latestHistoryEntry =
    history.length > 0
      ? history[
          history.length - 1
        ]
      : null;

  const displayedHistory =
    historyExpanded
      ? history
      : latestHistoryEntry
        ? [latestHistoryEntry]
        : [];

  const canEdit =
    !approvalMode &&
    isRequestor &&
    [0, 4].includes(
      currentStatus,
    );

  const canSubmitDraft =
    !approvalMode &&
    isRequestor &&
    currentStatus === 0;

  const canResubmitPR =
    !approvalMode &&
    isRequestor &&
    currentStatus === 4;

  const canTakeApprovalAction =
    approvalMode &&
    hasAuthenticatedEmployee &&
    pendingWithEmployeeId ===
      currentEmployeeId &&
    PENDING_APPROVAL_STATUSES.includes(
      currentStatus,
    );

  const validApprovalActions =
    Object.values(
      PR_APPROVAL_ACTIONS,
    );

  const handleSubmitDraft =
    async () => {
      if (!canSubmitDraft) {
        setRequestorActionError(
          "This Purchase Requisition cannot be submitted by the current user.",
        );

        return;
      }

      const shouldSubmit =
        window.confirm(
          `Submit ${header.prNumber} for approval?`,
        );

      if (!shouldSubmit) {
        return;
      }

      try {
        setRequestorActionProcessing(
          true,
        );

        setRequestorActionMessage(
          "",
        );

        setRequestorActionError(
          "",
        );

        await submitDraftPR({
          prId:
            header.prId,
        });

        setRequestorActionMessage(
          `${header.prNumber} submitted successfully.`,
        );

        await refresh();
      } catch (submitError) {
        setRequestorActionError(
          submitError?.response
            ?.data?.message ||
            submitError?.message ||
            "Unable to submit Draft PR",
        );
      } finally {
        setRequestorActionProcessing(
          false,
        );
      }
    };

  const handleResubmit =
    async () => {
      if (!canResubmitPR) {
        setRequestorActionError(
          "This Purchase Requisition cannot be resubmitted by the current user.",
        );

        return;
      }

      const shouldResubmit =
        window.confirm(
          `Resubmit ${header.prNumber} for approval?`,
        );

      if (!shouldResubmit) {
        return;
      }

      try {
        setRequestorActionProcessing(
          true,
        );

        setRequestorActionMessage(
          "",
        );

        setRequestorActionError(
          "",
        );

        await resubmitSentBackPR({
          prId:
            header.prId,

          remarks:
            "Purchase Requisition updated and resubmitted",
        });

        setRequestorActionMessage(
          `${header.prNumber} resubmitted successfully.`,
        );

        await refresh();
      } catch (resubmitError) {
        setRequestorActionError(
          resubmitError?.response
            ?.data?.message ||
            resubmitError?.message ||
            "Unable to resubmit Purchase Requisition",
        );
      } finally {
        setRequestorActionProcessing(
          false,
        );
      }
    };

  const handleOpenAction = (
    action,
  ) => {
    if (!canTakeApprovalAction) {
      setActionError(
        "This Purchase Requisition is not pending with the current approver.",
      );

      return;
    }

    if (
      !validApprovalActions.includes(
        action,
      )
    ) {
      setActionError(
        "Invalid approval action.",
      );

      return;
    }

    setActionSuccess(false);
    setActionError("");
    setSelectedAction(action);
  };

  const handleCloseAction = () => {
    if (actionProcessing) {
      return;
    }

    setSelectedAction(null);
    setActionSuccess(false);
    setActionError("");
  };

  const handleConfirmAction =
    async (remarks) => {
      if (
        !hasAuthenticatedEmployee
      ) {
        setActionError(
          "Your authenticated employee details are unavailable.",
        );

        return;
      }

      if (
        selectedAction === null ||
        !validApprovalActions.includes(
          selectedAction,
        )
      ) {
        setActionError(
          "Please select a valid approval action.",
        );

        return;
      }

      if (!canTakeApprovalAction) {
        setActionError(
          "This Purchase Requisition is no longer pending with the current approver.",
        );

        return;
      }

      try {
        setActionProcessing(true);
        setActionSuccess(false);
        setActionError("");

        await processPRApprovalAction({
          prId:
            header.prId,

          action:
            selectedAction,

          remarks:
            remarks?.trim() ||
            "",
        });

        setActionSuccess(true);

        await refresh();
      } catch (approvalError) {
        setActionError(
          approvalError?.response
            ?.data?.message ||
            approvalError?.message ||
            "Unable to process approval action",
        );
      } finally {
        setActionProcessing(false);
      }
    };

  const handleBackToApprovals =
    () => {
      setSelectedAction(null);
      setActionSuccess(false);
      setActionError("");

      navigate("/approvals");
    };

  const handleViewUpdatedPR =
    () => {
      setSelectedAction(null);
      setActionSuccess(false);
      setActionError("");

      navigate(
        `/approvals/${header.prId}`,
        {
          replace: true,

          state: {
            returnTo,
            returnLabel,
          },
        },
      );
    };

  return (
    <main className="pr-details-page">
      <header className="details-header">
        <div>
          <button
            type="button"
            className={
              "back-link-button " +
              "button-with-icon"
            }
            onClick={() =>
              navigate(returnTo)
            }
          >
            {returningToHistory ? (
              <History
                size={17}
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <LayoutDashboard
                size={17}
                strokeWidth={2}
                aria-hidden="true"
              />
            )}

            <span>
              {returnLabel}
            </span>
          </button>

          <h1>
            {header.prNumber}
          </h1>

          <span
            className={
              `status-badge ` +
              getStatusClass(
                currentStatus,
              )
            }
          >
            {header.statusDescription ||
              "Status unavailable"}
          </span>
        </div>

        <div className="details-page-actions">
          {canEdit && (
            <button
              type="button"
              className={
                "secondary-button " +
                "button-with-icon"
              }
              onClick={() =>
                navigate(
                  `/purchase-requisitions/${header.prId}/edit`,
                )
              }
            >
              <SquarePen
                size={17}
                strokeWidth={2}
                aria-hidden="true"
              />

              <span>
                Edit PR
              </span>
            </button>
          )}

          <button
            type="button"
            className={
              "secondary-button " +
              "button-with-icon"
            }
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              strokeWidth={2}
              className={
                loading
                  ? "refresh-icon spinning"
                  : "refresh-icon"
              }
              aria-hidden="true"
            />

            <span>
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </span>
          </button>
        </div>
      </header>

      <section className="details-card">
        <h2>
          Request Details
        </h2>

        <div className="details-grid">
          <div className="details-field">
            <span>
              Requestor
            </span>

            <strong>
              {header.requestorName ||
                "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Department
            </span>

            <strong>
              {header.departmentName ||
                "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Cost Centre
            </span>

            <strong>
              {header.costCentreName ||
                "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Current Status
            </span>

            <strong>
              {header.statusDescription ||
                "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Pending With
            </span>

            <strong>
              {header.pendingWithRoleName ||
                "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Approval Level
            </span>

            <strong>
              {Number(
                header.pendingWithLevel,
              ) > 0
                ? header.pendingWithLevel
                : "-"}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Created On
            </span>

            <strong>
              {formatDateTime(
                header.createdOn,
              )}
            </strong>
          </div>

          <div className="details-field">
            <span>
              Updated On
            </span>

            <strong>
              {formatDateTime(
                header.updatedOn,
              )}
            </strong>
          </div>
        </div>

        <div className="details-remarks">
          <span>
            Business Justification
          </span>

          <p>
            {header.remarks || "-"}
          </p>
        </div>
      </section>

      <section className="details-card">
        <div className="details-section-heading">
          <h2>
            Requested Items
          </h2>

          <span>
            {lines.length}
          </span>
        </div>

        {lines.length === 0 ? (
          <p className="details-empty">
            No requested items found.
          </p>
        ) : (
          <div className="pr-table-container">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>
                    Line Code
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Quantity
                  </th>

                  <th>
                    UOM
                  </th>

                  <th>
                    Expected Delivery
                  </th>

                  <th>
                    Estimated Cost
                  </th>
                </tr>
              </thead>

              <tbody>
                {lines.map(
                  (
                    line,
                    index,
                  ) => (
                    <tr
                      key={
                        line.lineId ||
                        `${line.itemId}-${index}`
                      }
                    >
                      <td>
                        {line.lineCode ||
                          "-"}
                      </td>

                      <td>
                        {line.description ||
                          "-"}
                      </td>

                      <td>
                        {line.quantity}
                      </td>

                      <td>
                        {line.uom || "-"}
                      </td>

                      <td>
                        {formatDate(
                          line.expectedDeliveryDate,
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          line.estimatedCost,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="details-total">
          <span>
            Total Estimated Cost
          </span>

          <strong>
            {formatCurrency(
              header.amount,
            )}
          </strong>
        </div>
      </section>

      <section className="details-card">
        <div className="details-section-heading">
          <h2>
            Supporting Documents
          </h2>

          <span>
            {attachments.length}
          </span>
        </div>

        {attachments.length === 0 ? (
          <p className="details-empty">
            No supporting documents
            attached.
          </p>
        ) : (
          <ul className="details-attachment-list">
            {attachments.map(
              (
                attachment,
                index,
              ) => {
                const attachmentUrl =
                  resolveAttachmentUrl(
                    attachment.filePath,
                  );

                return (
                  <li
                    key={
                      attachment.attachId ||
                      `${attachment.fileName}-${index}`
                    }
                  >
                    <span>
                      {attachment.fileName ||
                        "Attachment"}
                    </span>

                    {attachmentUrl ? (
                      <button
                        type="button"
                        className="attachment-open-button"
                        onClick={() =>
                          handleOpenAttachment(
                            attachmentUrl,
                          )
                        }
                      >
                        Open / Download
                      </button>
                    ) : (
                      <span className="attachment-unavailable">
                        File unavailable
                      </span>
                    )}
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>

      <section className="details-card">
        <div className="workflow-history-header">
          <div
            className={
              "details-section-heading " +
              "workflow-heading-content"
            }
          >
            <div>
              <h2>
                Workflow History
              </h2>
            </div>

            <span>
              {history.length}
            </span>
          </div>

          {history.length > 1 && (
            <button
              type="button"
              className={
                historyExpanded
                  ? "workflow-toggle-button expanded"
                  : "workflow-toggle-button"
              }
              onClick={() =>
                setHistoryExpanded(
                  (currentValue) =>
                    !currentValue,
                )
              }
              aria-expanded={
                historyExpanded
              }
              aria-controls="workflow-history-content"
              title={
                historyExpanded
                  ? "Collapse workflow history"
                  : "Expand complete workflow history"
              }
            >
              <span
                className="workflow-arrow"
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          )}
        </div>

        <div id="workflow-history-content">
          {displayedHistory.length ===
          0 ? (
            <p className="details-empty">
              No workflow history available.
            </p>
          ) : (
            <ol className="workflow-timeline">
              {displayedHistory.map(
                (
                  entry,
                  index,
                ) => (
                  <li
                    key={
                      entry.logId ||
                      `${entry.actionType}-${index}`
                    }
                  >
                    <div
                      className="timeline-marker"
                      aria-hidden="true"
                    />

                    <div className="timeline-content">
                      <div className="timeline-heading">
                        <strong>
                          {entry.actionType ||
                            "ACTION"}
                        </strong>

                        <span>
                          {formatDateTime(
                            entry.createdOn,
                          )}
                        </span>
                      </div>

                      <p>
                        {entry.description ||
                          "-"}
                      </p>

                      <small>
                        Action by:{" "}
                        {entry.name || "-"}
                      </small>
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>
      </section>

      {!approvalMode &&
        (canSubmitDraft ||
          canResubmitPR) && (
          <section className="pr-details-action-card">
            <div>
              <h2>
                Requestor Action
              </h2>

              <p>
                {canSubmitDraft
                  ? "Submit this Draft Purchase Requisition for approval."
                  : "Resubmit this corrected Purchase Requisition for approval."}
              </p>
            </div>

            <div className="pr-details-requestor-actions">
              {canSubmitDraft && (
                <button
                  type="button"
                  className={
                    "primary-button " +
                    "button-with-icon"
                  }
                  onClick={
                    handleSubmitDraft
                  }
                  disabled={
                    requestorActionProcessing
                  }
                >
                  {requestorActionProcessing ? (
                    <span
                      className="icon-button-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}

                  <span>
                    {requestorActionProcessing
                      ? "Submitting..."
                      : "Submit PR"}
                  </span>
                </button>
              )}

              {canResubmitPR && (
                <button
                  type="button"
                  className={
                    "primary-button " +
                    "button-with-icon"
                  }
                  onClick={
                    handleResubmit
                  }
                  disabled={
                    requestorActionProcessing
                  }
                >
                  {requestorActionProcessing ? (
                    <span
                      className="icon-button-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Repeat
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}

                  <span>
                    {requestorActionProcessing
                      ? "Resubmitting..."
                      : "Resubmit PR"}
                  </span>
                </button>
              )}
            </div>
          </section>
        )}

      {requestorActionMessage && (
        <p
          className="form-success"
          role="status"
        >
          {requestorActionMessage}
        </p>
      )}

      {requestorActionError && (
        <p
          className="field-error"
          role="alert"
        >
          {requestorActionError}
        </p>
      )}

      {approvalMode && (
        <section className="approval-review-card">
          <div>
            <h2>
              Approval Decision
            </h2>

            {canTakeApprovalAction ? (
              <p>
                Review the Purchase
                Requisition details and
                select an action.
              </p>
            ) : (
              <p>
                This Purchase Requisition
                is no longer pending with
                the current approver.
              </p>
            )}
          </div>

          {canTakeApprovalAction && (
            <div className="approval-review-actions">
              <button
                type="button"
                className={
                  "approval-button " +
                  "approval-button-approve"
                }
                onClick={() =>
                  handleOpenAction(
                    PR_APPROVAL_ACTIONS.APPROVE,
                  )
                }
                disabled={
                  actionProcessing
                }
              >
                Approve
              </button>

              <button
                type="button"
                className={
                  "approval-button " +
                  "approval-button-reject"
                }
                onClick={() =>
                  handleOpenAction(
                    PR_APPROVAL_ACTIONS.REJECT,
                  )
                }
                disabled={
                  actionProcessing
                }
              >
                Reject
              </button>

              <button
                type="button"
                className={
                  "approval-button " +
                  "approval-button-send-back"
                }
                onClick={() =>
                  handleOpenAction(
                    PR_APPROVAL_ACTIONS.SEND_BACK,
                  )
                }
                disabled={
                  actionProcessing
                }
              >
                Send Back
              </button>
            </div>
          )}
        </section>
      )}

      {selectedAction}
    </main>
  );
}